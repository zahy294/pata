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

/** Per payload: the clip once read (null: no clip), or the read in flight. Cleared when the link ends. */
const audioByPayload = new Map<string, { value?: Uint8Array | null; loading?: Promise<void> }>();

/**
 * The clip (up to 128 KiB) loads in the background, so a slow read through the mixnet never hides the
 * door: on a phone over mobile data on 2026-11-06 it kept the whole view on "checking" for 15 minutes.
 * Returns the clip once read, else null (the page polls again and the AudioPlayer picks it up).
 */
function backgroundAudio(
  payloadKey: string,
  audioKey: `0x${string}`,
  sealKey: CryptoKey,
  owner: `0x${string}`,
): Uint8Array | null {
  const entry = audioByPayload.get(payloadKey) ?? {};
  audioByPayload.set(payloadKey, entry);
  if (entry.value !== undefined) return entry.value;
  entry.loading ??= readGrantAudio(audioKey, sealKey, owner)
    .then((clip) => {
      entry.value = clip;
    })
    .catch(() => {
      /* An RPC failure is retried on the next poll. */
    })
    .finally(() => {
      entry.loading = undefined;
    });
  return null;
}

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
    const audio =
      audioKey && /^0x[\da-fA-F]{64}$/.test(audioKey)
        ? backgroundAudio(link.payloadKey, audioKey, identity.sealKey, owner)
        : null;
    // The sealed payload carries the same locality, so a failed public lookup can't hide the door.
    return { state: "live", locality: locality ?? opened.payload.locality, payload: opened.payload, audio };
  } catch {
    return { state: "checking", locality };
  } finally {
    link.sessionKey.fill(0);
  }
}
