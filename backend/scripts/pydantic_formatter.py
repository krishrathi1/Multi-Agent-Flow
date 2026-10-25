#!/usr/bin/env python3
"""
Pydantic v2 Structured Output Generator and Formatter for Multi-Agent Systems (MAS).
Validates agent deliverables and formats output into:
1. Strict JSON (schema-conforming)
2. Tabular format (Markdown/ASCII table)
3. Structured Markdown Document
"""

import sys
import json
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field, field_validator

class MetricItem(BaseModel):
    name: str = Field(..., description="Name of the measured metric")
    value: float = Field(..., description="Numerical value of metric")
    unit: str = Field(default="", description="Unit of measurement (e.g. ms, tokens, %, USD)")
    status: str = Field(default="NORMAL", description="Status health: NORMAL, WARNING, CRITICAL")

class AgentDeliverable(BaseModel):
    agent_id: str = Field(..., description="ID of the producing agent")
    agent_name: str = Field(..., description="Display name of the agent")
    stage: int = Field(..., ge=1, description="Execution stage number")
    deliverable_type: str = Field(..., description="Type of deliverable: SPEC, CODE, REPORT, TEST, CONFIG")
    title: str = Field(..., description="Title of the deliverable item")
    summary: str = Field(..., description="Detailed description or summary")
    confidence: float = Field(default=1.0, ge=0.0, le=1.0, description="Confidence score from 0.0 to 1.0")

class StructuredProcessOutput(BaseModel):
    title: str = Field(..., description="Title of the MAS process execution")
    summary: str = Field(..., description="Executive summary of the completed workflow")
    status: str = Field(default="COMPLETED", description="Execution status: COMPLETED, PARTIAL, FAILED")
    architecture_pattern: str = Field(default="Hierarchical", description="Agentic design pattern used")
    messaging_architecture: str = Field(default="Blackboard", description="Messaging paradigm used")
    pydantic_validated: bool = Field(default=True, description="Strict Pydantic validation flag")
    timestamp: str = Field(default_factory=lambda: datetime.utcnow().isoformat() + "Z")
    metrics: List[MetricItem] = Field(default_factory=list, description="Performance and cost metrics")
    deliverables: List[AgentDeliverable] = Field(default_factory=list, description="Individual agent deliverables")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        allowed = {"COMPLETED", "PARTIAL", "FAILED", "RUNNING"}
        if v.upper() not in allowed:
            raise ValueError(f"Status must be one of {allowed}")
        return v.upper()

def format_table(data: StructuredProcessOutput) -> str:
    """Generates clean Markdown and ASCII table views of the structured data."""
    lines = []
    lines.append("### 📊 Metrics Table")
    lines.append("| Metric Name | Value | Unit | Status |")
    lines.append("| :--- | :--- | :--- | :--- |")
    for m in data.metrics:
        lines.append(f"| **{m.name}** | {m.value:g} | {m.unit} | `{m.status}` |")
    
    lines.append("")
    lines.append("### 📦 Deliverables Table")
    lines.append("| Stage | Agent | Deliverable | Type | Confidence | Summary |")
    lines.append("| :--- | :--- | :--- | :--- | :--- | :--- |")
    for d in data.deliverables:
        conf_pct = f"{int(d.confidence * 100)}%"
        lines.append(f"| Stage {d.stage} | **{d.agent_name}** | {d.title} | `{d.deliverable_type}` | {conf_pct} | {d.summary} |")
    
    return "\n".join(lines)

def format_markdown(data: StructuredProcessOutput) -> str:
    """Generates a rich, executive Markdown report."""
    md = []
    md.append(f"# 🛰️ {data.title}")
    md.append("")
    md.append(f"> **Architecture Pattern:** `{data.architecture_pattern}` | **Messaging:** `{data.messaging_architecture}` | **Pydantic Validated:** `✔ Schema Conforming`")
    md.append("")
    md.append(f"### 📋 Executive Summary")
    md.append(data.summary)
    md.append("")
    md.append(format_table(data))
    md.append("")
    md.append("---")
    md.append(f"*Report compiled at `{data.timestamp}` under strict Pydantic v2 data contract validation.*")
    return "\n".join(md)

def main():
    try:
        raw_input = sys.stdin.read()
        if not raw_input.strip():
            # Generate default sample MAS output
            payload = {
                "title": "Production Multi-Agent Delivery Cycle",
                "summary": "Multi-agent fleet successfully planned, developed, tested, and validated deliverables across 3 stages using Blackboard shared context.",
                "status": "COMPLETED",
                "architecture_pattern": "Hierarchical (Supervisor-Worker)",
                "messaging_architecture": "Blackboard Architecture",
                "metrics": [
                    {"name": "Total Tokens", "value": 4120.0, "unit": "tokens", "status": "NORMAL"},
                    {"name": "Execution Latency", "value": 340.0, "unit": "ms", "status": "NORMAL"},
                    {"name": "Context Retention Rate", "value": 99.4, "unit": "%", "status": "NORMAL"},
                    {"name": "Total Cost", "value": 0.0082, "unit": "USD", "status": "NORMAL"}
                ],
                "deliverables": [
                    {"agent_id": "lead-arch", "agent_name": "Supervisor Lead", "stage": 1, "deliverable_type": "SPEC", "title": "System Architecture & Task Graph", "summary": "Decoupled MAS spec using Blackboard pattern and A2A interop.", "confidence": 0.98},
                    {"agent_id": "backend-worker", "agent_name": "Backend Specialist", "stage": 2, "deliverable_type": "CODE", "title": "MCP Tool Bridges & Pydantic Engine", "summary": "Implemented database lookup, calculator, forecasting, and file parser.", "confidence": 0.95},
                    {"agent_id": "qa-worker", "agent_name": "QA & Security Agent", "stage": 3, "deliverable_type": "TEST", "title": "Regression & Verification Test Suite", "summary": "12/12 end-to-end integration tests passed without regression.", "confidence": 1.0}
                ]
            }
        else:
            payload = json.loads(raw_input)

        # Validate with Pydantic
        model = StructuredProcessOutput.model_validate(payload)
        
        json_output = model.model_dump()
        table_output = format_table(model)
        markdown_output = format_markdown(model)
        json_schema = StructuredProcessOutput.model_json_schema()

        result = {
            "pydanticValidated": True,
            "version": "pydantic-v2",
            "jsonSchema": json_schema,
            "json": json_output,
            "table": table_output,
            "markdown": markdown_output
        }

        print(json.dumps(result))

    except Exception as e:
        err_res = {
            "pydanticValidated": False,
            "error": str(e),
            "errorType": type(e).__name__
        }
        print(json.dumps(err_res))
        sys.exit(1)

if __name__ == "__main__":
    main()
