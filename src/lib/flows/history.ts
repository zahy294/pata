// History (P1-2): every grant this household issued, and how each one ended. Screens call these.
// The entries are readonly Arkiv entities sealed to the household (pata.history.v1), so the household
// holds its own record of consent: no one else can read it, and no one can quietly edit it.
import type { HistoryEntry, RequesterInfo } from "../../../shared/domain";
import type { HouseholdKeys } from "../keys";
import { listHistory } from "../arkiv";

export interface ConsentRecord {
  grantLabel: string;
  requester: RequesterInfo;
  purpose: string;
  /** Unix seconds; null when only the "revoked" entry survives. */
  issuedAt: number | null;
  grantEnd: number;
  stoppedAt: number | null;
  /** "ended": expired on its own; "stopped": the household revoked it. */
  status: "live" | "ended" | "stopped";
}

/** One record per grant, newest first. Pure: `nowSeconds` decides live versus ended. */
export function consentRecords(entries: HistoryEntry[], nowSeconds: number): ConsentRecord[] {
  const issued = new Map<string, HistoryEntry>();
  const revoked = new Map<string, HistoryEntry>();
  for (const entry of entries) {
    const byLabel = entry.kind === "issued" ? issued : revoked;
    const seen = byLabel.get(entry.grantLabel);
    // A refreshed deadline (approve-grant.ts) may leave two "issued" entries: the later one counts.
    if (!seen || entry.at > seen.at) byLabel.set(entry.grantLabel, entry);
  }
  const labels = new Set([...issued.keys(), ...revoked.keys()]);
  return [...labels]
    .map((label): ConsentRecord => {
      const start = issued.get(label);
      const stop = revoked.get(label);
      const base = (start ?? stop)!;
      return {
        grantLabel: label,
        requester: base.requester,
        purpose: base.purpose,
        issuedAt: start?.at ?? null,
        grantEnd: start?.grantEnd ?? base.grantEnd,
        stoppedAt: stop?.at ?? null,
        status: stop ? "stopped" : (start?.grantEnd ?? 0) > nowSeconds ? "live" : "ended",
      };
    })
    .sort((a, b) => (b.issuedAt ?? b.stoppedAt ?? 0) - (a.issuedAt ?? a.stoppedAt ?? 0));
}

export async function loadConsentHistory(keys: HouseholdKeys, nowSeconds: number): Promise<ConsentRecord[]> {
  let entries: HistoryEntry[];
  try {
    entries = await listHistory(keys);
  } catch {
    throw new Error("Couldn't read your history right now.");
  }
  return consentRecords(entries, nowSeconds);
}
