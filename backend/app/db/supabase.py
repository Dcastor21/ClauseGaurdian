from supabase import Client, create_client

from app.config import get_settings

_anon: Client | None = None
_service: Client | None = None


def get_anon_client() -> Client:
    global _anon
    if _anon is None:
        s = get_settings()
        _anon = create_client(s.SUPABASE_URL, s.SUPABASE_ANON_KEY)
    return _anon


def get_service_client() -> Client:
    global _service
    if _service is None:
        s = get_settings()
        _service = create_client(s.SUPABASE_URL, s.SUPABASE_SERVICE_ROLE_KEY)
    return _service
