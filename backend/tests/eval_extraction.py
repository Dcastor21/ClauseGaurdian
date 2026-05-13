#!/usr/bin/env python3
"""
Daily extraction precision eval.

Runs the clause extraction pipeline against a known fixture contract and exits
non-zero if precision falls below the threshold in sample_nda_annotations.json.

Usage:
    python tests/eval_extraction.py

Requires OPENROUTER_API_KEY and HELICONE_API_KEY in the environment.
All other required env vars are filled with placeholders so Pydantic Settings
validation passes without touching real external services.
"""
from __future__ import annotations

import asyncio
import json
import os
import sys
from pathlib import Path
from unittest.mock import MagicMock, patch

# Placeholders let Pydantic Settings validate; real API keys come from env.
_PLACEHOLDERS = {
    "CLERK_SECRET_KEY": "sk_test_eval_placeholder",
    "CLERK_WEBHOOK_SECRET": "whsec_eval_placeholder",
    "CLERK_JWT_ISSUER": "https://eval.clerk.dev",
    "SUPABASE_URL": "https://eval.supabase.co",
    "SUPABASE_ANON_KEY": "eval-anon-placeholder",
    "SUPABASE_SERVICE_ROLE_KEY": "eval-service-placeholder",
    "RESEND_API_KEY": "re_eval_placeholder",
    "NTFY_TOPIC": "eval-topic",
    "UPSTASH_REDIS_REST_URL": "https://eval.upstash.io",
    "UPSTASH_REDIS_REST_TOKEN": "eval-token-placeholder",
    "SENTRY_DSN": "",
    "ENVIRONMENT": "ci",
}
for key, val in _PLACEHOLDERS.items():
    os.environ.setdefault(key, val)

from langchain_core.documents import Document  # noqa: E402
from langchain_text_splitters import RecursiveCharacterTextSplitter  # noqa: E402

FIXTURES_DIR = Path(__file__).parent / "fixtures"


def _make_chunks(text: str, contract_id: str) -> list[Document]:
    base = Document(
        page_content=text,
        metadata={"page": 1, "contract_id": contract_id, "source": "eval-fixture"},
    )
    splitter = RecursiveCharacterTextSplitter.from_tiktoken_encoder(
        encoding_name="cl100k_base",
        chunk_size=1000,
        chunk_overlap=200,
    )
    chunks = splitter.split_documents([base])
    for i, chunk in enumerate(chunks):
        chunk.metadata["chunk_index"] = i
    return chunks


async def run_eval() -> bool:
    annotations = json.loads((FIXTURES_DIR / "sample_nda_annotations.json").read_text())
    fixture_text = (FIXTURES_DIR / "sample_nda.txt").read_text()
    expected: set[str] = set(annotations["expected_clause_types"])
    threshold: float = annotations.get("precision_threshold", 0.85)
    contract_id = "00000000-0000-0000-0000-000000000001"

    chunks = _make_chunks(fixture_text, contract_id)
    print(f"Fixture chunks: {len(chunks)}")

    # Clear settings cache so placeholders above take effect.
    from app.config import get_settings  # noqa: E402
    get_settings.cache_clear()

    # Patch DB write so the eval never touches Supabase.
    with patch("app.services.pipeline._write_clauses", new=MagicMock()):
        from app.services.pipeline import run_extraction  # noqa: E402
        clauses = await run_extraction(chunks, contract_id, "user_eval")

    found: set[str] = {c.clause_type for c in clauses}
    true_pos = found & expected
    false_pos = found - expected
    false_neg = expected - found
    precision = len(true_pos) / max(len(found), 1)

    print(f"Expected : {sorted(expected)}")
    print(f"Found    : {sorted(found)}")
    print(f"TP       : {sorted(true_pos)}")
    print(f"FP       : {sorted(false_pos)}")
    print(f"FN       : {sorted(false_neg)}")
    print(f"Precision: {precision:.2%}  (threshold {threshold:.0%})")

    if precision < threshold:
        print(f"\nFAIL — precision {precision:.2%} is below the {threshold:.0%} threshold")
        return False

    print(f"\nPASS — precision {precision:.2%} >= {threshold:.0%}")
    return True


if __name__ == "__main__":
    passed = asyncio.run(run_eval())
    sys.exit(0 if passed else 1)
