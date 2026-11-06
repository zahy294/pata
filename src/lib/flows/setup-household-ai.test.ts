import { afterEach, expect, it, vi } from "vitest";
import { describeTheWay, findCandidatePins } from "./setup-household";
import { testHouseholdKeys } from "../server-client/test-helpers";
import { recordingFixture } from "../server-client/recording-fixtures";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const parts = { locality: { name: "Dharavi", pinCode: "400017" }, landmarkPhrases: ["Temple"] };

it("turns a typed way to the door into extracted setup fields through the signed client", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(parts));
  vi.stubGlobal("fetch", network);
  const typed = "धारावी 400017 मंदिर के पीछे";
  await expect(describeTheWay(await testHouseholdKeys(), typed, "hi")).resolves.toEqual({
    wayToTheDoor: typed,
    ...parts,
  });
  expect(JSON.parse(String(network.mock.calls[0][1]?.body))).toEqual({ wayToTheDoor: typed, language: "hi" });
});

it("preserves the empty candidate response so setup can open a hand-dropped pin", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const result = { candidates: [], bbox: [72.848, 19.036, 72.866, 19.055], duplicateLandmarkName: false };
  const network = vi.fn<typeof fetch>().mockResolvedValue(Response.json(result));
  vi.stubGlobal("fetch", network);
  await expect(
    findCandidatePins(await testHouseholdKeys(), "behind Temple", parts.locality, parts.landmarkPhrases),
  ).resolves.toEqual(result);
  expect(JSON.parse(String(network.mock.calls[0][1]?.body))).toEqual({
    wayToTheDoor: "behind Temple",
    locality: parts.locality,
    landmarkPhrases: ["Temple"],
  });
});

it("runs typed extraction then ranking with a candidate ready for confirmation", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const ranked = {
    candidates: [
      {
        point: { lat: 19.04, lon: 72.85 },
        landmark: {
          osmId: "node/1",
          name: "Temple",
          kind: "amenity=place_of_worship",
          point: { lat: 19.04, lon: 72.85 },
        },
        relation: "near",
        confidence: "medium",
        metresFromLandmark: 0,
      },
    ],
    bbox: [72.848, 19.036, 72.866, 19.055],
    duplicateLandmarkName: false,
  };
  const network = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) => Response.json(String(url).endsWith("/extract") ? parts : ranked));
  vi.stubGlobal("fetch", network);
  const keys = await testHouseholdKeys();
  const extracted = await describeTheWay(keys, "near Temple in Dharavi 400017", "en");
  if (!extracted.locality) throw new Error("Expected locality");
  const result = await findCandidatePins(
    keys,
    extracted.wayToTheDoor,
    extracted.locality,
    extracted.landmarkPhrases,
  );
  expect(result).toEqual(ranked);
  expect(network).toHaveBeenCalledTimes(2);
});

it("transcribes a recording before extracting address parts from the resulting way to the door", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const transcript = "धारावी 400017 मंदिर के पीछे";
  const network = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) =>
      Response.json(String(url).includes("/speech/in") ? { transcript } : parts),
    );
  vi.stubGlobal("fetch", network);
  await expect(
    describeTheWay(await testHouseholdKeys(), new Blob([await recordingFixture()]), "hi"),
  ).resolves.toEqual({ wayToTheDoor: transcript, ...parts });
  expect(network).toHaveBeenCalledTimes(2);
  expect(String(network.mock.calls[0][0])).toContain("/speech/in?lang=hi");
  expect(JSON.parse(String(network.mock.calls[1][1]?.body))).toEqual({
    wayToTheDoor: transcript,
    language: "hi",
  });
});

it("stops before extraction if transcription fails", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const network = vi
    .fn<typeof fetch>()
    .mockResolvedValue(Response.json({ error: "PRIVATE_PROVIDER_DETAILS" }, { status: 502 }));
  vi.stubGlobal("fetch", network);
  await expect(
    describeTheWay(await testHouseholdKeys(), new Blob([await recordingFixture()]), "hi"),
  ).rejects.toMatchObject({
    name: "ServerError",
    status: 502,
    code: "server_error",
    message: "Server request failed",
  });
  expect(network).toHaveBeenCalledTimes(1);
});

it("continues spoken setup through candidate lookup with the transcript", async () => {
  vi.stubEnv("NEXT_PUBLIC_SERVER_URL", "https://worker.test");
  const transcript = "near Temple in Dharavi 400017";
  const result = {
    candidates: [
      {
        point: { lat: 19.04, lon: 72.85 },
        landmark: {
          osmId: "node/1",
          name: "Temple",
          kind: "amenity=place_of_worship",
          point: { lat: 19.04, lon: 72.85 },
        },
        relation: "near",
        confidence: "medium",
        metresFromLandmark: 0,
      },
    ],
    bbox: [72.848, 19.036, 72.866, 19.055],
    duplicateLandmarkName: false,
  };
  const network = vi
    .fn<typeof fetch>()
    .mockImplementation(async (url) =>
      Response.json(
        String(url).includes("/speech/in")
          ? { transcript }
          : String(url).endsWith("/extract")
            ? parts
            : result,
      ),
    );
  vi.stubGlobal("fetch", network);
  const keys = await testHouseholdKeys();
  const extracted = await describeTheWay(keys, new Blob([await recordingFixture()]), "hi");
  if (!extracted.locality) throw new Error("Expected locality");
  await expect(
    findCandidatePins(keys, extracted.wayToTheDoor, extracted.locality, extracted.landmarkPhrases),
  ).resolves.toEqual(result);
  expect(JSON.parse(String(network.mock.calls[2][1]?.body)).wayToTheDoor).toBe(transcript);
});
