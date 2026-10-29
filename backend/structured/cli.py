"""Command line bridge between the Node backend and the Pydantic models.

    python cli.py schema <Model>      JSON Schema of a model
    python cli.py validate <Model>    stdin JSON -> {"ok", "data" | "errors"}
    python cli.py final               stdin JSON -> {"ok", "data", "markdown" | "errors"}

Always prints one JSON object on stdout and exits 0, so the caller only has
to parse the answer; a non-zero exit means the bridge itself broke.
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from pydantic import ValidationError  # noqa: E402

from schemas import MODELS, FinalOutput  # noqa: E402


def _errors(err: ValidationError) -> list[dict]:
    return [
        {"loc": ".".join(str(p) for p in e["loc"]) or "(root)", "msg": e["msg"], "type": e["type"]}
        for e in err.errors(include_url=False)
    ][:30]


def main(argv: list[str]) -> dict:
    if not argv:
        return {"ok": False, "errors": [{"loc": "(cli)", "msg": "no command", "type": "usage"}]}
    command = argv[0]

    if command == "schema":
        model = MODELS.get(argv[1] if len(argv) > 1 else "")
        if not model:
            return {"ok": False, "errors": [{"loc": "(cli)", "msg": f"unknown model; use one of {sorted(MODELS)}", "type": "usage"}]}
        return {"ok": True, "schema": model.model_json_schema()}

    try:
        payload = json.loads(sys.stdin.read() or "null")
    except json.JSONDecodeError as exc:
        return {"ok": False, "errors": [{"loc": "(root)", "msg": f"not valid JSON: {exc.msg}", "type": "json_invalid"}]}

    try:
        if command == "validate":
            model = MODELS.get(argv[1] if len(argv) > 1 else "")
            if not model:
                return {"ok": False, "errors": [{"loc": "(cli)", "msg": "unknown model", "type": "usage"}]}
            return {"ok": True, "data": model.model_validate(payload).model_dump(mode="json")}
        if command == "final":
            final = FinalOutput.model_validate(payload)
            return {"ok": True, "data": final.model_dump(mode="json"), "markdown": final.to_markdown()}
    except ValidationError as err:
        return {"ok": False, "errors": _errors(err)}

    return {"ok": False, "errors": [{"loc": "(cli)", "msg": f"unknown command {command}", "type": "usage"}]}


if __name__ == "__main__":
    sys.stdout.reconfigure(encoding="utf-8")
    print(json.dumps(main(sys.argv[1:]), ensure_ascii=False))
