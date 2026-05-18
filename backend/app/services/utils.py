import json
import logging

logger = logging.getLogger(__name__)


def parse_llm_json(content: str) -> dict | list | None:
    content = content.strip()
    if content.startswith("```"):
        lines = content.splitlines()
        content = "\n".join(lines[1:-1]).strip()
    try:
        return json.loads(content)
    except json.JSONDecodeError:
        return None
