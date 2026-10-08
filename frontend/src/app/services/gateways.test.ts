import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import { approvePairing, denyPairing, lookupPairing } from "./gateways";

vi.mock("./api", () => ({ api: { get: vi.fn(), post: vi.fn() } }));

afterEach(() => vi.clearAllMocks());

it("looks up a pairing session by user code", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { session_id: "abc" } });

  await lookupPairing("BCDF-GHJK");

  expect(api.post).toHaveBeenCalledWith("/gateways/pairing-sessions/lookup", {
    user_code: "BCDF-GHJK",
  });
});

it("approves a pairing session with the explicit confirmation", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { session_id: "abc", status: "approved" } });

  await approvePairing("ses_1", {
    user_code: "BCDF-GHJK",
    gateway_id: 7,
    confirm: true,
    replace_credential: true,
  });

  expect(api.post).toHaveBeenCalledWith("/gateways/pairing-sessions/ses_1/approve", {
    user_code: "BCDF-GHJK",
    gateway_id: 7,
    confirm: true,
    replace_credential: true,
  });
});

it("denies a pairing session by user code", async () => {
  vi.mocked(api.post).mockResolvedValue({ data: { session_id: "abc", status: "denied" } });

  await denyPairing("ses_1", "BCDF-GHJK");

  expect(api.post).toHaveBeenCalledWith("/gateways/pairing-sessions/ses_1/deny", {
    user_code: "BCDF-GHJK",
  });
});
