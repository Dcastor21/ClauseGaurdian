import io
from unittest.mock import MagicMock

import pytest

from tests.helpers import TEST_USER_ID, make_jwt

CONTRACT_ID = "11111111-1111-1111-1111-111111111111"
CONTRACT_ROW = {
    "id": CONTRACT_ID,
    "clerk_user_id": TEST_USER_ID,
    "name": "test-contract.pdf",
    "file_url": f"{TEST_USER_ID}/{CONTRACT_ID}.pdf",
    "status": "processing",
    "overall_risk": None,
    "expires_at": None,
    "created_at": "2026-05-06T00:00:00+00:00",
}

DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def _auth():
    return {"Authorization": f"Bearer {make_jwt()}"}


def _minimal_pdf() -> bytes:
    return b"%PDF-1.4\n%%EOF"


def _minimal_docx() -> bytes:
    from docx import Document

    doc = Document()
    doc.add_paragraph("Test contract clause.")
    buf = io.BytesIO()
    doc.save(buf)
    return buf.getvalue()


# --- auth enforcement ---

def test_upload_no_auth_rejected(main_client):
    resp = main_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("test.pdf", _minimal_pdf(), "application/pdf")},
    )
    assert resp.status_code in (401, 403)


def test_list_no_auth_rejected(main_client):
    resp = main_client.get("/api/v1/contracts/")
    assert resp.status_code in (401, 403)


def test_get_no_auth_rejected(main_client):
    resp = main_client.get(f"/api/v1/contracts/{CONTRACT_ID}")
    assert resp.status_code in (401, 403)


def test_delete_no_auth_rejected(main_client):
    resp = main_client.delete(f"/api/v1/contracts/{CONTRACT_ID}")
    assert resp.status_code in (401, 403)


# --- upload validation ---

def test_upload_jpg_returns_415(contracts_client):
    resp = contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("photo.jpg", b"\xff\xd8\xff", "image/jpeg")},
        headers=_auth(),
    )
    assert resp.status_code == 415


def test_upload_too_large_returns_413(contracts_client):
    big_file = b"%PDF-1.4" + b"0" * (21 * 1024 * 1024)
    resp = contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("big.pdf", big_file, "application/pdf")},
        headers=_auth(),
    )
    assert resp.status_code == 413


# --- upload success ---

def test_upload_pdf_returns_201(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[CONTRACT_ROW]
    )

    resp = contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("contract.pdf", _minimal_pdf(), "application/pdf")},
        headers=_auth(),
    )
    assert resp.status_code == 201
    assert resp.json()["status"] == "processing"


def test_upload_docx_returns_201(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[CONTRACT_ROW]
    )

    resp = contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("contract.docx", _minimal_docx(), DOCX_MIME)},
        headers=_auth(),
    )
    assert resp.status_code == 201


def test_upload_calls_storage(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[CONTRACT_ROW]
    )

    contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("contract.pdf", _minimal_pdf(), "application/pdf")},
        headers=_auth(),
    )
    mock_contracts_supabase.storage.from_.assert_called_with("contracts")
    mock_contracts_supabase.storage.from_.return_value.upload.assert_called_once()


def test_upload_calls_db_insert(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[CONTRACT_ROW]
    )

    contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("contract.pdf", _minimal_pdf(), "application/pdf")},
        headers=_auth(),
    )
    mock_contracts_supabase.table.assert_called_with("contracts")
    mock_contracts_supabase.table.return_value.insert.assert_called_once()


def test_upload_uses_processing_status(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.insert.return_value.execute.return_value = MagicMock(
        data=[CONTRACT_ROW]
    )

    contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("contract.pdf", _minimal_pdf(), "application/pdf")},
        headers=_auth(),
    )
    call_kwargs = mock_contracts_supabase.table.return_value.insert.call_args[0][0]
    assert call_kwargs["status"] == "processing"


def test_upload_db_fail_deletes_storage_orphan(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.insert.return_value.execute.side_effect = Exception(
        "DB down"
    )

    resp = contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("contract.pdf", _minimal_pdf(), "application/pdf")},
        headers=_auth(),
    )
    assert resp.status_code == 502
    mock_contracts_supabase.storage.from_.return_value.remove.assert_called_once()


def test_upload_db_fk_missing_user_returns_helpful_502(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.insert.return_value.execute.side_effect = Exception(
        {
            "message": (
                'insert or update on table "contracts" violates foreign key constraint "contracts_clerk_user_id_fkey"'
            ),
            "code": "23503",
        }
    )

    resp = contracts_client.post(
        "/api/v1/contracts/upload",
        files={"file": ("contract.pdf", _minimal_pdf(), "application/pdf")},
        headers=_auth(),
    )

    assert resp.status_code == 502
    assert "User record not found" in resp.json()["detail"]
    mock_contracts_supabase.storage.from_.return_value.remove.assert_called_once()


# --- list ---

def test_list_returns_contracts(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
        data=[CONTRACT_ROW]
    )

    resp = contracts_client.get("/api/v1/contracts/", headers=_auth())
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["id"] == CONTRACT_ID


def test_list_filters_by_user(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.select.return_value.eq.return_value.order.return_value.execute.return_value = MagicMock(
        data=[]
    )

    resp = contracts_client.get("/api/v1/contracts/", headers=_auth())
    assert resp.status_code == 200
    mock_contracts_supabase.table.return_value.select.return_value.eq.assert_called_with(
        "clerk_user_id", TEST_USER_ID
    )


# --- get ---

def test_get_returns_contract(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
        data=CONTRACT_ROW
    )

    resp = contracts_client.get(f"/api/v1/contracts/{CONTRACT_ID}", headers=_auth())
    assert resp.status_code == 200
    assert resp.json()["id"] == CONTRACT_ID


def test_get_other_user_contract_returns_404(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.side_effect = Exception(
        "no rows returned"
    )

    resp = contracts_client.get(f"/api/v1/contracts/{CONTRACT_ID}", headers=_auth())
    assert resp.status_code == 404


# --- delete ---

def test_delete_returns_204(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
        data={"id": CONTRACT_ID, "file_url": f"{TEST_USER_ID}/{CONTRACT_ID}.pdf"}
    )

    resp = contracts_client.delete(f"/api/v1/contracts/{CONTRACT_ID}", headers=_auth())
    assert resp.status_code == 204


def test_delete_removes_storage_file(contracts_client, mock_contracts_supabase):
    file_url = f"{TEST_USER_ID}/{CONTRACT_ID}.pdf"
    mock_contracts_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.return_value = MagicMock(
        data={"id": CONTRACT_ID, "file_url": file_url}
    )

    contracts_client.delete(f"/api/v1/contracts/{CONTRACT_ID}", headers=_auth())
    mock_contracts_supabase.storage.from_.return_value.remove.assert_called_once_with([file_url])


def test_delete_nonexistent_returns_404(contracts_client, mock_contracts_supabase):
    mock_contracts_supabase.table.return_value.select.return_value.eq.return_value.eq.return_value.single.return_value.execute.side_effect = Exception(
        "no rows returned"
    )

    resp = contracts_client.delete(f"/api/v1/contracts/{CONTRACT_ID}", headers=_auth())
    assert resp.status_code == 404
