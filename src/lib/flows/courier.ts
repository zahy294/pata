// "Open a courier link" (docs/plan.md, P0-11). Owner: blockchain builds the checks; frontend builds /c.
// 1. parseCourierFragment(location.hash); keys → sessionStorage; history.replaceState removes the "#".
// 2. Show the locality at once (lookupLocality).
// 3. ENS check: grantStatusByName(<label>.<household>) owner must equal the owner derived from the session key.
// 4. Read the payload; its Arkiv $owner must equal householdOwner(household name). Missing → ended.
//    Its audio entity is read once per link and kept for this page (a clip is up to 128 KiB).
// 5. Poll both every few seconds; whichever ends first → "ended", clear sessionStorage.
import type { GrantPayload, Locality } from "../../../shared/domain";
import { parseCourierFragment } from "../link";
import { lookupLocality, householdOwner } from "../ens/lookup";
import { grantStatusByName } from "../ens/grants";
import { deriveGrantIdentity } from "../keys";
import { readGrantPayload, readGrantAudio } from "../arkiv";
import { PROVIDER_NAME } from "../../../shared/constants";
import { isValidHouseholdLabel } from "../ens/names";

export type CourierView =
  | { state: "checking"; locality: Locality | null }
  /** audio: AAC bytes (audio/aac); null → read payload.directions with speechSynthesis (ADR 0007). */
  | { state: "live"; locality: Locality; payload: GrantPayload; audio: Uint8Array | null }
  | { state: "ended"; locality: Locality | null }
  | { state: "invalid" };

const audioByPayload = new Map<string, Uint8Array | null>();

/** One check of both signals. The /c page calls it on load and on a timer. */
export async function checkCourierLink(fragmentOrStored: string): Promise<CourierView> {
  const link = parseCourierFragment(fragmentOrStored);
  if (!link) return { state: "invalid" };
  const suffix = `.${PROVIDER_NAME}`;
  if (
    !link.householdName.endsWith(suffix) ||
    !isValidHouseholdLabel(link.householdName.slice(0, -suffix.length)) ||
    !/^0x[\da-fA-F]{64}$/.test(link.payloadKey) ||
    link.sessionKey.length !== 32
  ) {
    link.sessionKey.fill(0);
    return { state: "invalid" };
  }
  let locality: Locality | null = null;
  try {
    locality = await lookupLocality(link.householdName);
  } catch {
    /* Public locality can be retried independently. */
  }
  try {
    const identity = await deriveGrantIdentity(link.sessionKey);
    const status = await grantStatusByName(`${identity.label}.${link.householdName}`);
    const ended = () => {
      audioByPayload.delete(link.payloadKey);
      return { state: "ended" as const, locality };
    };
    if (!status.live || status.owner.toLowerCase() !== identity.owner.address.toLowerCase()) return ended();
    const owner = await householdOwner(link.householdName);
    if (!owner) return ended();
    const opened = await readGrantPayload(link.payloadKey, identity.sealKey, owner);
    if (!opened) return ended();
    const { audioKey } = opened.payload;
    // An RPC failure throws (→ checking) and is retried; a missing clip is remembered as null.
    if (!audioByPayload.has(link.payloadKey))
      audioByPayload.set(
        link.payloadKey,
        audioKey && /^0x[\da-fA-F]{64}$/.test(audioKey)
          ? await readGrantAudio(audioKey, identity.sealKey, owner)
          : null,
      );
    const audio = audioByPayload.get(link.payloadKey) ?? null;
    return locality
      ? { state: "live", locality, payload: opened.payload, audio }
      : { state: "checking", locality };
  } catch {
    return { state: "checking", locality };
  } finally {
    link.sessionKey.fill(0);
  }
}
