import { afterEach, expect, it, vi } from "vitest";
import { api } from "./api";
import {
  getClientDashboardPreferences,
  getMyDashboardPreferences,
  updateClientDashboardPreferences,
} from "./dashboardPreferences";

vi.mock("./api", () => ({ api: { get: vi.fn(), put: vi.fn() } }));

afterEach(() => vi.clearAllMocks());

it("reads a client's dashboard preferences", async () => {
  vi.mocked(api.get).mockResolvedValue({ data: { client_id: 3, cards: null } });

  const preferences = await getClientDashboardPreferences(3);

  expect(api.get).toHaveBeenCalledWith("/clients/3/dashboard-preferences");
  expect(preferences).toEqual({ client_id: 3, cards: null });
});

it("saves a client's dashboard preferences with the cards body", async () => {
  vi.mocked(api.put).mockResolvedValue({
    data: { client_id: 3, cards: ["priority.humidity", "soil.chart"] },
  });

  const preferences = await updateClientDashboardPreferences(3, [
    "priority.humidity",
    "soil.chart",
  ]);

  expect(api.put).toHaveBeenCalledWith("/clients/3/dashboard-preferences", {
    cards: ["priority.humidity", "soil.chart"],
  });
  expect(preferences.cards).toEqual(["priority.humidity", "soil.chart"]);
});

it("clears the selection and returns to the automatic mode with cards null", async () => {
  vi.mocked(api.put).mockResolvedValue({ data: { client_id: 3, cards: null } });

  const preferences = await updateClientDashboardPreferences(3, null);

  expect(api.put).toHaveBeenCalledWith("/clients/3/dashboard-preferences", { cards: null });
  expect(preferences.cards).toBeNull();
});

it("reads the current client's own dashboard preferences", async () => {
  vi.mocked(api.get).mockResolvedValue({
    data: { client_id: 3, cards: ["sources.external"] },
  });

  await getMyDashboardPreferences();

  expect(api.get).toHaveBeenCalledWith("/clients/me/dashboard-preferences");
});
