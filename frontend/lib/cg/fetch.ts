// lib/cg/fetch.ts — load real backend data and adapt it to the design model.

import {
  getContract,
  listClauses,
  listContracts,
  listDeadlines,
  type Contract,
} from '@/lib/api'
import { adaptContract } from './adapt'
import type { CgContract } from './data'

/** Contract list only — fast, no per-contract clause/deadline round-trips. */
export async function loadContractsShallow(token: string): Promise<CgContract[]> {
  const contracts = await listContracts(token)
  return contracts.map((c) => adaptContract(c))
}

async function detailFor(token: string, c: Contract): Promise<CgContract> {
  if (c.status !== 'complete') return adaptContract(c)
  try {
    const [clauses, deadlines] = await Promise.all([
      listClauses(token, c.id),
      listDeadlines(token, c.id),
    ])
    return adaptContract(c, clauses, deadlines)
  } catch {
    return adaptContract(c)
  }
}

/** Contract list with clauses + deadlines hydrated for every complete contract. */
export async function loadContractsDetailed(token: string): Promise<CgContract[]> {
  const contracts = await listContracts(token)
  return Promise.all(contracts.map((c) => detailFor(token, c)))
}

/** A single contract with clauses + deadlines. */
export async function loadContractDetail(
  token: string,
  id: string,
): Promise<CgContract> {
  const c = await getContract(token, id)
  if (c.status !== 'complete') return adaptContract(c)
  const [clauses, deadlines] = await Promise.all([
    listClauses(token, id),
    listDeadlines(token, id),
  ])
  return adaptContract(c, clauses, deadlines)
}
