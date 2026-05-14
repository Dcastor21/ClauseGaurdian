const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

export interface Contract {
  id: string
  name: string
  status: 'processing' | 'analyzing' | 'complete' | 'failed'
  overall_risk: 'critical' | 'high' | 'medium' | 'low' | null
  created_at: string
  expires_at: string | null
  clerk_user_id: string
  file_url: string | null
}

export interface Clause {
  id: string
  contract_id: string
  clause_type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  raw_text: string | null
  summary: string | null
  recommended_action: string | null
  page_ref: number | null
}

export interface Deadline {
  id: string
  contract_id: string
  clause_id: string | null
  deadline_date: string
  alert_window: string
  alert_status: string
}

async function apiFetch<T>(path: string, token: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`${res.status}: ${text}`)
  }
  return res.json()
}

export async function listContracts(
  token: string,
  opts: { search?: string } = {},
): Promise<Contract[]> {
  const p = new URLSearchParams()
  if (opts.search) p.set('search', opts.search)
  const qs = p.toString() ? `?${p}` : ''
  return apiFetch(`/api/v1/contracts${qs}`, token)
}

export async function getContract(token: string, id: string): Promise<Contract> {
  return apiFetch(`/api/v1/contracts/${id}`, token)
}

export async function uploadContract(token: string, file: File, name?: string): Promise<Contract> {
  const form = new FormData()
  form.append('file', file)
  if (name) form.append('name', name)
  const res = await fetch(`${API_BASE}/api/v1/contracts/upload`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: form,
  })
  if (!res.ok) throw new Error(`${res.status}: ${await res.text().catch(() => '')}`)
  return res.json()
}

export async function deleteContract(token: string, id: string): Promise<void> {
  await apiFetch(`/api/v1/contracts/${id}`, token, { method: 'DELETE' })
}

export async function listClauses(token: string, contractId: string): Promise<Clause[]> {
  return apiFetch(`/api/v1/clauses?contract_id=${contractId}`, token)
}

export async function listDeadlines(token: string, contractId: string): Promise<Deadline[]> {
  return apiFetch(`/api/v1/deadlines?contract_id=${contractId}`, token)
}

export interface AlertPreferences {
  email: boolean
  push: boolean
  windows: number[]
}

export interface UserProfile {
  id: string
  clerk_user_id: string
  email: string
  plan: string
  alert_preferences: AlertPreferences
  contracts_this_month: number
  monthly_limit: number
  created_at: string
}

export async function getMe(token: string): Promise<UserProfile> {
  return apiFetch('/api/v1/users/me', token)
}

export async function updatePreferences(
  token: string,
  prefs: Partial<AlertPreferences>,
): Promise<{ alert_preferences: AlertPreferences }> {
  return apiFetch('/api/v1/users/me/preferences', token, {
    method: 'PATCH',
    body: JSON.stringify(prefs),
  })
}
