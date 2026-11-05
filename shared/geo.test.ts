// Owner: AI/ML (P0-7). Plain geometry must be exact to the metre: pin distances are a judging claim.
import { describe, it } from "vitest";

describe("geo", () => {
  it.todo("distanceMetres: 0 for the same point; ~111,195 m for 1° of latitude");
  it.todo("distanceMetres: Dak Bhawan to a point 25 m north is 25 ± 0.1 m");
  it.todo("bearingDegrees: due north is 0, due east is 90");
  it.todo("offsetPoint then distanceMetres returns the offset");
  it.todo("nearestPointOnLine snaps to the closest segment, not the closest vertex");
  it.todo("pinsDisagree is true just above the threshold and false at it");
});
