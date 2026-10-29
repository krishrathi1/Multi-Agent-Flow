"""Unit tests for the structured-output models: python -m unittest discover structured"""

import unittest
from datetime import datetime, timezone

from pydantic import ValidationError

from schemas import FinalOutput, StageOutput


def stage(**over):
    base = {"agent": "Frontend Developer", "stage": 1, "status": "completed", "summary": "Built the expense splitter UI."}
    return {**base, **over}


def final(**over):
    base = {
        "production": "Expense Splitter",
        "goal": "Split shared expenses.",
        "run_id": "80b870bc-0000",
        "status": "completed",
        "messaging_mode": "BLACKBOARD",
        "generated_at": datetime(2026, 10, 29, tzinfo=timezone.utc).isoformat(),
        "stages": [stage()],
        "metrics": {"tokens": 1200, "cost_usd": 0.01, "agent_steps": 1},
    }
    return {**base, **over}


class StageOutputTests(unittest.TestCase):
    def test_coerces_what_agents_naturally_write(self):
        s = StageOutput.model_validate(stage(status="Done", deliverables=["src/App.jsx", "./src/App.jsx"], issues=["Footer overlaps"]))
        self.assertEqual(s.status.value, "completed")
        self.assertEqual([d.path for d in s.deliverables], ["src/App.jsx"])
        self.assertEqual(s.issues[0].severity.value, "info")

    def test_rejects_unknown_status_and_thin_summary(self):
        with self.assertRaises(ValidationError) as ctx:
            StageOutput.model_validate(stage(status="vibing", summary="ok"))
        self.assertEqual({e["loc"][0] for e in ctx.exception.errors()}, {"status", "summary"})

    def test_drops_platform_files_from_deliverables(self):
        s = StageOutput.model_validate(stage(deliverables=["index.html", ".agent-output/qa-reviewer.json", "./.blackboard/posts/qa.jsonl"]))
        self.assertEqual([d.path for d in s.deliverables], ["index.html"])

    def test_ignores_extra_fields(self):
        self.assertFalse(hasattr(StageOutput.model_validate(stage(mood="great")), "mood"))


class FinalOutputTests(unittest.TestCase):
    def test_completed_run_cannot_contain_a_failed_stage(self):
        with self.assertRaises(ValidationError):
            FinalOutput.model_validate(final(stages=[stage(), stage(agent="QA", stage=2, status="failed")]))
        self.assertEqual(FinalOutput.model_validate(final(status="failed", stages=[stage(status="failed")])).status.value, "failed")

    def test_renders_markdown_tables(self):
        md = FinalOutput.model_validate(final(deliverables=[{"path": "src/App.jsx", "description": "UI | root"}])).to_markdown()
        self.assertIn("# Expense Splitter — final output", md)
        self.assertIn("| 1 | Frontend Developer | ✅ completed |", md)
        self.assertIn("| `src/App.jsx` | UI \\| root |", md)
        self.assertIn("Validated against the FinalOutput schema v1.0 (Pydantic)", md)


if __name__ == "__main__":
    unittest.main()
