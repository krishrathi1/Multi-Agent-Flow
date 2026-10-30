"""Pydantic models for MyceliumOps' structured output.

Every agent ends its step with a ``StageOutput``; every run ends with a
``FinalOutput`` assembled from its stages. These models are the single
definition of both: the backend validates what agents write against them,
asks them for their JSON Schema, and renders the final output from them as
Markdown tables or JSON.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Literal, Optional

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

SCHEMA_VERSION = "1.0"

# Workspace folders the platform writes for itself; never project deliverables.
INTERNAL_DIRS = (".agent-output/", ".blackboard/", ".agent-notes/")


class Status(str, Enum):
    completed = "completed"
    partial = "partial"
    blocked = "blocked"
    failed = "failed"


class Severity(str, Enum):
    critical = "critical"
    major = "major"
    minor = "minor"
    info = "info"


# Words agents use for a status, mapped to the four the schema allows.
STATUS_SYNONYMS = {
    "done": "completed", "complete": "completed", "success": "completed", "succeeded": "completed",
    "ok": "completed", "approved": "completed", "finished": "completed", "passed": "completed",
    "in_progress": "partial", "incomplete": "partial", "partially_completed": "partial",
    "error": "failed", "failure": "failed", "rejected": "failed",
    "waiting": "blocked", "on_hold": "blocked",
}

SEVERITY_SYNONYMS = {"high": "major", "medium": "minor", "low": "info", "blocker": "critical", "warning": "minor"}


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore", str_strip_whitespace=True)


class Deliverable(_Model):
    path: str = Field(min_length=1, max_length=300, description="File path relative to the workspace root")
    description: str = Field(default="", max_length=300, description="What the file is or does")

    @model_validator(mode="before")
    @classmethod
    def _from_string(cls, value):
        # Agents often list deliverables as bare paths.
        return {"path": value} if isinstance(value, str) else value


class Issue(_Model):
    severity: Severity = Severity.info
    description: str = Field(min_length=3, max_length=600)
    resolved: bool = False

    @model_validator(mode="before")
    @classmethod
    def _from_string(cls, value):
        return {"description": value} if isinstance(value, str) else value

    @field_validator("severity", mode="before")
    @classmethod
    def _severity(cls, value):
        if isinstance(value, str):
            key = value.strip().lower()
            return SEVERITY_SYNONYMS.get(key, key)
        return value


class TestRun(_Model):
    ran: bool
    passed: Optional[bool] = None
    command: Optional[str] = Field(default=None, max_length=200)
    details: Optional[str] = Field(default=None, max_length=600)


class StageOutput(_Model):
    """What one agent hands over at the end of its step."""

    agent: str = Field(min_length=1, max_length=120)
    role: Optional[str] = Field(default=None, max_length=200)
    stage: int = Field(ge=0, le=100)
    status: Status
    summary: str = Field(min_length=10, max_length=2000, description="2-4 sentences: what was produced and its state")
    deliverables: list[Deliverable] = Field(default_factory=list, max_length=60)
    decisions: list[str] = Field(default_factory=list, max_length=20)
    issues: list[Issue] = Field(default_factory=list, max_length=30)
    tests: Optional[TestRun] = None
    tools_used: list[str] = Field(default_factory=list, max_length=30)
    next_steps: list[str] = Field(default_factory=list, max_length=10)
    verdict: Optional[Literal["approved", "changes_requested"]] = Field(
        default=None, description="Reviewers only: whether the work meets the brief"
    )
    source: Literal["agent", "derived"] = Field(
        default="agent", description="agent: written by the agent; derived: built from its summary and files"
    )

    @field_validator("status", mode="before")
    @classmethod
    def _status(cls, value):
        if isinstance(value, str):
            key = value.strip().lower().replace(" ", "_").replace("-", "_")
            return STATUS_SYNONYMS.get(key, key)
        return value

    @field_validator("deliverables")
    @classmethod
    def _unique_paths(cls, value: list[Deliverable]):
        # One entry per file, and none of the platform's own bookkeeping
        # (agents tend to list the output file they are writing).
        seen: dict[str, Deliverable] = {}
        for item in value:
            path = item.path.removeprefix("./")
            if path.startswith(INTERNAL_DIRS):
                continue
            seen.setdefault(path, item)
        return list(seen.values())


class Metrics(_Model):
    duration_seconds: Optional[float] = Field(default=None, ge=0)
    tokens: int = Field(default=0, ge=0)
    cost_usd: float = Field(default=0, ge=0)
    agent_steps: int = Field(default=0, ge=0)
    tool_calls: int = Field(default=0, ge=0)
    blackboard_entries: int = Field(default=0, ge=0)


class FinalOutput(_Model):
    """The structured result of one production run."""

    schema_version: Literal["1.0"] = SCHEMA_VERSION
    production: str = Field(min_length=1, max_length=200)
    goal: str = Field(min_length=1, max_length=4000)
    run_id: str = Field(min_length=1)
    status: Status
    messaging_mode: Literal["BLACKBOARD", "PEER_TO_PEER"]
    orchestration_pattern: Optional[Literal["HYBRID", "SEQUENTIAL", "PARALLEL", "HIERARCHICAL"]] = None
    generated_at: datetime
    stages: list[StageOutput] = Field(default_factory=list)
    deliverables: list[Deliverable] = Field(default_factory=list)
    open_issues: list[Issue] = Field(default_factory=list)
    qa_verdict: Optional[Literal["approved", "changes_requested"]] = None
    metrics: Metrics
    preview_url: Optional[str] = None

    @model_validator(mode="after")
    def _consistent(self):
        # A run can't be "completed" while one of its stages failed.
        if self.status == Status.completed and any(s.status == Status.failed for s in self.stages):
            raise ValueError("status is 'completed' but at least one stage failed")
        if self.open_issues and any(i.resolved for i in self.open_issues):
            raise ValueError("open_issues must not contain resolved issues")
        return self

    # ── Rendering ────────────────────────────────────────────────────────

    def to_markdown(self) -> str:
        def cell(text: object) -> str:
            return str(text if text is not None else "—").replace("|", "\\|").replace("\n", " ").strip() or "—"

        icon = {"completed": "✅", "partial": "🟡", "blocked": "⏸️", "failed": "❌"}
        m = self.metrics
        out = [
            f"# {self.production} — final output",
            "",
            f"> {cell(self.goal[:500])}",
            "",
            "| Field | Value |",
            "|---|---|",
            f"| Status | {icon[self.status.value]} {self.status.value} |",
            f"| Run | `{self.run_id[:8]}` |",
            f"| Context sharing | {'Blackboard (shared state)' if self.messaging_mode == 'BLACKBOARD' else 'Peer-to-peer'} |",
            f"| Agentic pattern | {cell(self.orchestration_pattern.title() if self.orchestration_pattern else None)} |",
            f"| QA verdict | {cell(self.qa_verdict.replace('_', ' ') if self.qa_verdict else None)} |",
            f"| Duration | {cell(f'{m.duration_seconds:.0f} s' if m.duration_seconds is not None else None)} |",
            f"| Tokens / cost | {m.tokens:,} / ${m.cost_usd:.4f} |",
            f"| Agent steps · tool calls · board entries | {m.agent_steps} · {m.tool_calls} · {m.blackboard_entries} |",
        ]
        if self.preview_url:
            out.append(f"| Preview | {self.preview_url} |")
        out.append(f"| Generated | {self.generated_at.strftime('%Y-%m-%d %H:%M UTC')} |")

        if self.stages:
            out += ["", "## Stages", "", "| # | Agent | Status | Deliverables | Issues | Tests | Source |", "|--:|---|---|--:|--:|---|---|"]
            for s in self.stages:
                tests = "—" if not s.tests else ("not run" if not s.tests.ran else ("passed" if s.tests.passed else "failed" if s.tests.passed is False else "ran"))
                out.append(f"| {s.stage} | {cell(s.agent)} | {icon[s.status.value]} {s.status.value} | {len(s.deliverables)} | {len(s.issues)} | {tests} | {s.source} |")
            for s in self.stages:
                out += ["", f"### Stage {s.stage} · {s.agent}", "", s.summary]
                if s.decisions:
                    out += ["", "**Decisions**", ""] + [f"- {d}" for d in s.decisions]
                if s.issues:
                    out += ["", "| Severity | Issue | Resolved |", "|---|---|---|"]
                    out += [f"| {i.severity.value} | {cell(i.description)} | {'yes' if i.resolved else 'no'} |" for i in s.issues]
                if s.tools_used:
                    out += ["", f"Tools used: {', '.join(f'`{t}`' for t in s.tools_used)}"]
                if s.next_steps:
                    out += ["", "**Next steps**", ""] + [f"- {n}" for n in s.next_steps]

        if self.deliverables:
            out += ["", "## Deliverables", "", "| File | Description |", "|---|---|"]
            out += [f"| `{cell(d.path)}` | {cell(d.description)} |" for d in self.deliverables]

        out += ["", "## Open issues", ""]
        if self.open_issues:
            out += ["| Severity | Issue |", "|---|---|"] + [f"| {i.severity.value} | {cell(i.description)} |" for i in self.open_issues]
        else:
            out.append("None.")
        out += ["", f"_Validated against the FinalOutput schema v{self.schema_version} (Pydantic)._", ""]
        return "\n".join(out)


# ── Hierarchical pattern: the supervisor's plan and review ─────────────────


class Assignment(_Model):
    """One task the supervisor gives one worker agent."""

    id: str = Field(min_length=1, max_length=20)
    agent: str = Field(min_length=1, max_length=120, description="Exact name of a worker agent")
    task: str = Field(min_length=10, max_length=1500)
    depends_on: list[str] = Field(default_factory=list, max_length=10, description="ids of assignments that must finish first")


def _check_dependencies(assignments: list[Assignment], known: set[str] | None = None) -> None:
    ids = [a.id for a in assignments]
    if len(ids) != len(set(ids)):
        raise ValueError("assignment ids must be unique")
    valid = set(ids) | (known or set())
    for a in assignments:
        missing = [d for d in a.depends_on if d not in valid]
        if missing:
            raise ValueError(f"assignment {a.id} depends on unknown ids {missing}")
    # No cycles: repeatedly remove assignments whose dependencies are all done.
    pending = {a.id: set(d for d in a.depends_on if d in ids) for a in assignments}
    while pending:
        ready = [i for i, deps in pending.items() if not deps]
        if not ready:
            raise ValueError(f"assignments have a dependency cycle: {sorted(pending)}")
        for i in ready:
            pending.pop(i)
        for deps in pending.values():
            deps.difference_update(ready)


class SupervisorPlan(_Model):
    rationale: str = Field(min_length=10, max_length=1500)
    assignments: list[Assignment] = Field(min_length=1, max_length=12)

    @model_validator(mode="after")
    def _dependencies(self):
        _check_dependencies(self.assignments)
        return self


class SupervisorReview(_Model):
    done: bool
    assessment: str = Field(min_length=10, max_length=1500)
    follow_ups: list[Assignment] = Field(default_factory=list, max_length=4)

    @model_validator(mode="after")
    def _consistent(self):
        if self.done and self.follow_ups:
            raise ValueError("done is true but follow_ups were given")
        if not self.done and not self.follow_ups:
            raise ValueError("done is false but no follow_ups were given")
        # Follow-ups run after the plan, so they can only depend on each other.
        _check_dependencies(self.follow_ups)
        return self


MODELS: dict[str, type[BaseModel]] = {
    "StageOutput": StageOutput,
    "FinalOutput": FinalOutput,
    "SupervisorPlan": SupervisorPlan,
    "SupervisorReview": SupervisorReview,
}
