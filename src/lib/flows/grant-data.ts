import { GRANT_LATENCY_MARGIN_SECONDS, ARKIV_MAX_DAYS } from "../../../shared/constants";
import type { GrantPayload, GrantRequest, HomeRecord } from "../../../shared/domain";
import { LANGUAGES } from "../../../shared/domain";

export function calculateGrantEnd(sepoliaTimestamp: number, durationSeconds: number): number {
  const end = sepoliaTimestamp + durationSeconds + GRANT_LATENCY_MARGIN_SECONDS;
  if (
    !Number.isSafeInteger(sepoliaTimestamp) ||
    sepoliaTimestamp < 0 ||
    !Number.isSafeInteger(durationSeconds) ||
    durationSeconds <= 0 ||
    durationSeconds + GRANT_LATENCY_MARGIN_SECONDS > ARKIV_MAX_DAYS * 86_400 ||
    !Number.isSafeInteger(end)
  )
    throw new Error("Invalid grant duration");
  return end;
}

export function buildGrantPayload(
  home: HomeRecord,
  request: GrantRequest,
  /** Null when setup kept no clip in request.language (ADR 0007 text fallback). */
  mp3: Uint8Array | null,
  grantEnd: number,
): GrantPayload {
  if (
    !LANGUAGES.includes(request.language) ||
    !request.requester.displayName.trim() ||
    !request.purpose.trim() ||
    !Number.isSafeInteger(grantEnd) ||
    grantEnd <= 0
  )
    throw new Error("Invalid grant request");
  let binary = "";
  for (let offset = 0; mp3 && offset < mp3.length; offset += 32_768)
    binary += String.fromCharCode(...mp3.subarray(offset, offset + 32_768));
  return {
    version: 1,
    requester: { ...request.requester },
    purpose: request.purpose,
    language: request.language,
    digipin: home.digipin,
    pin: { ...home.pin },
    locality: { ...home.locality },
    roomNumber: home.roomNumber,
    writtenAddress: home.writtenAddress,
    directions: home.directions[request.language],
    ...(mp3 ? { audioMp3Base64: btoa(binary) } : {}),
    grantEnd,
  };
}
