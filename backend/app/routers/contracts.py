# FILE: contracts.py | PURPOSE: Contract CRUD + file upload with Clerk auth gate | CONNECTS TO: main.py (router mount), middleware/clerk_auth.py (JWT), db/supabase.py (storage + db), db/models.py (ContractRead)

# ── IMPORTS ───────────────────────────────────────────────────────────────────
import logging
import uuid                                          # generate contract UUID before upload (needed for storage path)
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, BackgroundTasks
                                                     # BackgroundTasks: runs pipeline after response is sent
from app.config import get_settings                  # settings singleton for upload limits
from app.middleware.clerk_auth import get_current_user_id  # JWT dependency — injects clerk_user_id
from app.middleware.rate_limit import require_upload_rate_limit
from app.db.supabase import get_service_client       # service client used for all backend DB ops
from app.db.models import ContractRead, ContractCreate, ContractUpdate

logger = logging.getLogger(__name__)
router = APIRouter()

# ── CONSTANTS ─────────────────────────────────────────────────────────────────
# Allowed MIME types — must match the Storage bucket settings in schema.sql comments
ALLOWED_MIME_TYPES = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
}

# Extension map: MIME type → file extension used in the Storage path
MIME_TO_EXT = {
    "application/pdf": "pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
}

STORAGE_BUCKET = "contracts"   # Supabase Storage bucket name — must be created manually first


# ── UPLOAD ────────────────────────────────────────────────────────────────────
@router.post("/upload", response_model=ContractRead, status_code=201)
async def upload_contract(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),                              # multipart file field
    name: str | None = Form(None),                             # optional display name; defaults to filename
    clerk_user_id: str = Depends(get_current_user_id),         # JWT validation — rejects unauthenticated requests
    _: None = Depends(require_upload_rate_limit),              # 10 uploads / user / hour
) -> ContractRead:
    """
    WHY: This is the entry point for the entire ClauseGuardian pipeline.
    A user uploads a PDF or DOCX, we store it in Supabase Storage, create a contracts
    row, and kick off the async analysis pipeline in the background.

    FLOW:
      1. Validate MIME type — reject anything that's not PDF or DOCX
      2. Read file bytes and validate size — reject files over 10 MB
      3. Generate a contract UUID (needed before upload to build the storage path)
      4. Upload raw bytes to Supabase Storage at contracts/{clerk_user_id}/{contract_id}.{ext}
      5. Insert a contracts row with status="processing" and the storage path
      6. Enqueue the analysis pipeline as a background task (runs after response is sent)
      7. Return the new ContractRead — frontend polls status until it becomes "complete"

    Args:
        background_tasks: FastAPI background task queue — pipeline runs here
        file:             uploaded file from multipart/form-data
        name:             optional display name; if omitted, uses the original filename
        clerk_user_id:    injected by Depends(get_current_user_id) from the Clerk JWT

    Returns:
        ContractRead: the newly created contract row (status="processing")

    Raises:
        HTTPException 415: file type is not PDF or DOCX
        HTTPException 413: file exceeds 10 MB limit
        HTTPException 502: Supabase Storage upload failed
        HTTPException 502: Supabase DB insert failed
    """
    logger.debug(
        f"Upload received: user={clerk_user_id}, filename={file.filename!r}, "
        f"content_type={file.content_type!r}, size={file.size}"
    )

    # Step 1: Validate MIME type
    # content_type can be None if the client doesn't set it — treat None as invalid
    if file.content_type not in ALLOWED_MIME_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: '{file.content_type}'. Upload a PDF or DOCX.",
        )

    # Step 2: Read bytes + validate size
    # We read the entire file into memory here. For files up to 10 MB this is fine.
    # Decision: streaming upload would be more memory-efficient but complicates
    # the size check; at 10 MB the simplicity tradeoff is worth it.
    settings = get_settings()
    file_bytes = await file.read()
    max_bytes = settings.MAX_UPLOAD_BYTES
    if len(file_bytes) > max_bytes:
        max_mb = max_bytes // (1024 * 1024)
        raise HTTPException(
            status_code=413,
            detail=f"File too large: {len(file_bytes) / 1024 / 1024:.1f} MB. Maximum is {max_mb} MB.",
        )

    # Step 3: Generate contract UUID now so we can use it in both the storage path and DB row
    contract_id = str(uuid.uuid4())
    ext = MIME_TO_EXT[file.content_type]
    storage_path = f"{clerk_user_id}/{contract_id}.{ext}"
    display_name = name or file.filename or f"contract-{contract_id[:8]}"

    client = get_service_client()

    # Step 4: Upload to Supabase Storage
    # Path: contracts/{clerk_user_id}/{contract_id}.pdf (or .docx)
    # Using clerk_user_id as a folder makes it easy to audit and clean up per-user data.
    # Failure here: Storage bucket doesn't exist, service key invalid, or Supabase is down.
    try:
        storage_response = client.storage.from_(STORAGE_BUCKET).upload(
            path=storage_path,
            file=file_bytes,
            file_options={"content-type": file.content_type, "upsert": "false"},
        )
    except Exception as e:
        logger.error(f"Storage upload failed for contract_id={contract_id}: {e}", exc_info=True)
        raise HTTPException(
            status_code=502,
            detail="File storage failed — please try again. If this persists, contact support.",
        )

    logger.info(f"Uploaded to storage: {storage_path}")

    # Step 5: Insert contracts row
    # status="processing" signals the frontend to show a loading state.
    # The pipeline background task will update this to "analyzing" then "complete" (or "failed").
    # Failure here: DB is down, or users row doesn't exist yet (webhook hasn't fired).
    try:
        db_response = (
            client.table("contracts")
            .insert(
                {
                    "id": contract_id,
                    "clerk_user_id": clerk_user_id,
                    "name": display_name,
                    "file_url": storage_path,
                    "status": "processing",
                }
            )
            .execute()
        )
    except Exception as e:
        # Storage upload succeeded but DB insert failed — clean up the orphaned file
        logger.error(f"DB insert failed for contract_id={contract_id}: {e}", exc_info=True)
        _delete_from_storage(client, storage_path)
        if _is_missing_user_fk_error(e):
            raise HTTPException(
                status_code=502,
                detail=(
                    "User record not found in the database. "
                    "This can happen if Clerk has not yet synced the new account. "
                    "Please try again in a few seconds."
                ),
            )
        raise HTTPException(
            status_code=502,
            detail="Failed to save contract record. Please try again.",
        )

    if not db_response.data:
        _delete_from_storage(client, storage_path)
        raise HTTPException(status_code=502, detail="Contract record was not created.")

    contract_row = db_response.data[0]
    logger.info(f"Created contract row: id={contract_id}, user={clerk_user_id}")

    # Step 6: Enqueue analysis pipeline as a background task
    # BackgroundTasks runs AFTER FastAPI sends the 201 response — the user isn't waiting.
    # The pipeline updates status → "analyzing" → "complete" (or "failed") as it progresses.
    # Decision: background task vs. async queue (Celery/Redis):
    #   Background tasks are simpler for a single Render instance. When we scale to
    #   multiple workers, replace this with an Upstash queue or Celery task.
    background_tasks.add_task(_run_analysis_pipeline, contract_id, clerk_user_id, storage_path, ext)

    return ContractRead.model_validate(contract_row)


# ── LIST ──────────────────────────────────────────────────────────────────────
@router.get("/", response_model=list[ContractRead])
async def list_contracts(
    search: str | None = None,
    risk: str | None = None,
    clerk_user_id: str = Depends(get_current_user_id),
) -> list[ContractRead]:
    client = get_service_client()

    try:
        query = (
            client.table("contracts")
            .select("*")
            .eq("clerk_user_id", clerk_user_id)
        )
        if risk:
            query = query.eq("overall_risk", risk)
        if search:
            query = query.ilike("name", f"%{search}%")
        query = query.order("created_at", desc=True)
        response = query.execute()
        contracts: dict[str, dict] = {row["id"]: row for row in response.data}

        if search:
            clause_resp = (
                client.table("clauses")
                .select("contract_id")
                .ilike("raw_text", f"%{search}%")
                .execute()
            )
            clause_ids = list({r["contract_id"] for r in clause_resp.data})
            if clause_ids:
                cq = (
                    client.table("contracts")
                    .select("*")
                    .eq("clerk_user_id", clerk_user_id)
                    .in_("id", clause_ids)
                )
                if risk:
                    cq = cq.eq("overall_risk", risk)
                for row in cq.execute().data:
                    contracts.setdefault(row["id"], row)

        return [
            ContractRead.model_validate(row)
            for row in sorted(contracts.values(), key=lambda x: x.get("created_at", ""), reverse=True)
        ]
    except Exception as e:
        logger.error(f"Failed to list contracts for user={clerk_user_id}: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to retrieve contracts.")


# ── GET ───────────────────────────────────────────────────────────────────────
@router.get("/{contract_id}", response_model=ContractRead)
async def get_contract(
    contract_id: str,
    clerk_user_id: str = Depends(get_current_user_id),
) -> ContractRead:
    """
    WHY: Returns a single contract — used by the contract detail page.
    We filter by BOTH contract_id AND clerk_user_id so a user cannot fetch
    another user's contract by guessing its UUID.

    FLOW:
      1. Query contracts filtered by id + clerk_user_id (both must match)
      2. Return ContractRead or 404

    Args:
        contract_id:   UUID string from the URL path
        clerk_user_id: injected from the verified Clerk JWT

    Returns:
        ContractRead: the contract row

    Raises:
        HTTPException 404: contract not found or belongs to a different user
        HTTPException 502: DB query failed
    """
    client = get_service_client()

    try:
        response = (
            client.table("contracts")
            .select("*")
            .eq("id", contract_id)
            .eq("clerk_user_id", clerk_user_id)   # security: can't access other users' contracts
            .single()                               # raises if 0 or >1 rows returned
            .execute()
        )
    except Exception as e:
        # .single() raises if the row doesn't exist — map that to 404
        logger.info(f"Contract not found: id={contract_id}, user={clerk_user_id}")
        raise HTTPException(status_code=404, detail="Contract not found.")

    return ContractRead.model_validate(response.data)


# ── DELETE ────────────────────────────────────────────────────────────────────
@router.delete("/{contract_id}", status_code=204)
async def delete_contract(
    contract_id: str,
    clerk_user_id: str = Depends(get_current_user_id),
) -> None:
    """
    WHY: Lets users remove contracts they no longer need. Deleting the DB row cascades
    to clauses and deadlines (ON DELETE CASCADE in schema.sql).
    We also delete the file from Storage to avoid orphaned blobs.

    FLOW:
      1. Fetch the contract to confirm ownership and get the file_url for Storage cleanup
      2. Delete the file from Supabase Storage
      3. Delete the DB row (cascades: clauses, deadlines are deleted automatically)
      4. Return 204 No Content

    Args:
        contract_id:   UUID string from the URL path
        clerk_user_id: injected from the verified Clerk JWT

    Returns:
        None (204 No Content)

    Raises:
        HTTPException 404: contract not found or belongs to a different user
        HTTPException 502: DB delete failed
    """
    client = get_service_client()

    # Step 1: Verify ownership by fetching first — don't delete without confirming the user owns it
    try:
        response = (
            client.table("contracts")
            .select("id, file_url")
            .eq("id", contract_id)
            .eq("clerk_user_id", clerk_user_id)
            .single()
            .execute()
        )
    except Exception:
        raise HTTPException(status_code=404, detail="Contract not found.")

    file_url: str | None = response.data.get("file_url")

    # Step 2: Delete from Storage first (best effort — proceed even if this fails)
    # Failure here leaves an orphaned file but doesn't block the user from deleting the record.
    if file_url:
        _delete_from_storage(client, file_url)

    # Step 3: Delete DB row — cascades handle clauses/deadlines automatically
    try:
        client.table("contracts").delete().eq("id", contract_id).execute()
    except Exception as e:
        logger.error(f"Failed to delete contract id={contract_id}: {e}", exc_info=True)
        raise HTTPException(status_code=502, detail="Failed to delete contract.")

    logger.info(f"Deleted contract id={contract_id} for user={clerk_user_id}")
    # 204 No Content — FastAPI returns no body when the function returns None with status_code=204


# ── PRIVATE HELPERS ───────────────────────────────────────────────────────────

def _is_missing_user_fk_error(error: Exception) -> bool:
    if isinstance(error, dict):
        return (
            error.get("code") == "23503"
            and "contracts_clerk_user_id_fkey" in (error.get("message") or "")
        )

    message = str(error)
    return (
        "violates foreign key constraint \"contracts_clerk_user_id_fkey\"" in message
        or ("23503" in message and "contracts_clerk_user_id_fkey" in message)
    )


def _delete_from_storage(client, path: str) -> None:
    """
    WHY: Shared cleanup helper — called on DB insert failure and on contract delete.
    Best-effort: logs errors but does not raise, so callers can continue.

    Args:
        client: Supabase service client
        path:   Storage path, e.g. "user_xxx/contract-uuid.pdf"
    """
    try:
        client.storage.from_(STORAGE_BUCKET).remove([path])
        logger.info(f"Deleted from storage: {path}")
    except Exception as e:
        # Log but don't raise — orphaned files are less bad than crashing the request
        logger.warning(f"Failed to delete storage file at {path}: {e}")


async def _run_analysis_pipeline(
    contract_id: str,
    clerk_user_id: str,
    storage_path: str,
    file_ext: str,
) -> None:
    from app.services.alerts import send_push_alert
    from app.services.deadlines import extract_deadlines
    from app.services.ingestion import ingest_contract
    from app.services.pipeline import run_extraction
    from app.services.scorer import compute_overall_risk, score_clauses
    from app.services.summarizer import summarize_clauses

    client = get_service_client()
    client.table("contracts").update({"status": "analyzing"}).eq("id", contract_id).execute()
    logger.info(f"[pipeline] Starting analysis for contract_id={contract_id}")

    try:
        result = await ingest_contract(contract_id, storage_path, file_ext)
        logger.info(
            f"[pipeline] Ingestion complete: contract_id={contract_id}, "
            f"pages={result.page_count}, chunks={result.chunk_count}"
        )

        clauses = await run_extraction(result.chunks, contract_id, clerk_user_id)
        logger.info(f"[pipeline] Extracted {len(clauses)} clauses for contract_id={contract_id}")

        scored = await score_clauses(clauses, contract_id)
        overall_risk = compute_overall_risk(scored)
        logger.info(f"[pipeline] Scored {len(scored)} clauses, overall_risk={overall_risk} for contract_id={contract_id}")

        await summarize_clauses(scored, contract_id, clerk_user_id)
        logger.info(f"[pipeline] Summarization complete for contract_id={contract_id}")

        try:
            await extract_deadlines(result.chunks, contract_id)
            logger.info(f"[pipeline] Deadline extraction complete for contract_id={contract_id}")
        except Exception as e:
            logger.warning(f"[pipeline] Deadline extraction failed for contract_id={contract_id}: {e}")

        try:
            await _dispatch_push_alerts(client, scored, contract_id, clerk_user_id, send_push_alert)
        except Exception as e:
            logger.warning(f"[pipeline] Push alert dispatch failed for contract_id={contract_id}: {e}")

        client.table("contracts").update({"status": "complete", "overall_risk": overall_risk}).eq("id", contract_id).execute()
        logger.info(f"[pipeline] Complete: contract_id={contract_id}")

    except Exception as e:
        logger.error(f"[pipeline] Analysis failed for contract_id={contract_id}: {e}", exc_info=True)
        client.table("contracts").update({"status": "failed"}).eq("id", contract_id).execute()


async def _dispatch_push_alerts(client, scored, contract_id, clerk_user_id, send_push_alert_fn) -> None:
    high_clauses = [c for c in scored if c.severity in ("critical", "high")]
    if not high_clauses:
        return

    try:
        user_resp = (
            client.table("users")
            .select("alert_preferences")
            .eq("clerk_user_id", clerk_user_id)
            .single()
            .execute()
        )
        prefs = ((user_resp.data or {}).get("alert_preferences")) or {}
    except Exception:
        return

    if not prefs.get("push", True):
        return

    clause_types = ", ".join(c.clause_type for c in high_clauses[:3])
    suffix = f" (+{len(high_clauses) - 3} more)" if len(high_clauses) > 3 else ""
    await send_push_alert_fn(
        title="High-risk clauses detected",
        message=f"{len(high_clauses)} critical/high clause(s) found: {clause_types}{suffix}",
        contract_id=contract_id,
        clerk_user_id=clerk_user_id,
    )
