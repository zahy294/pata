// Directions writer. Owner: AI/ML (P0-9).
// One call that returns hi, mr and en text from the confirmed pin. Keep each language short enough
// for a ~20 s clip (ADR 0007).
import type {
  DirectionsRequest,
  DirectionsResponse,
} from "../../../shared/api";

export async function writeDirections(
  apiKey: string,
  req: DirectionsRequest,
): Promise<DirectionsResponse> {
  void apiKey;
  void req;
  throw new Error("writeDirections: not implemented (P0-9)");
}
