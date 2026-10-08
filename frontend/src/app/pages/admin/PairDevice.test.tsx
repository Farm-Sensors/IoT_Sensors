import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { Gateway } from "../../services/gateways";
import { PairDevice } from "./PairDevice";

const mocks = vi.hoisted(() => ({
  showToast: vi.fn(),
  listGateways: vi.fn(),
  lookupPairing: vi.fn(),
  approvePairing: vi.fn(),
  denyPairing: vi.fn(),
  getPropertyGatewayStatus: vi.fn(),
}));

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: mocks.showToast }),
}));

vi.mock("../../services/gateways", () => ({
  listGateways: mocks.listGateways,
  lookupPairing: mocks.lookupPairing,
  approvePairing: mocks.approvePairing,
  denyPairing: mocks.denyPairing,
  getPropertyGatewayStatus: mocks.getPropertyGatewayStatus,
}));

const pendingGateway: Gateway = {
  id: 7,
  property_id: 3,
  status: "pending_activation",
  configuration_version: 0,
  bindings_revision: 0,
  activated_at: null,
  revoked_at: null,
  slots: [],
};

const activeGateway: Gateway = {
  id: 9,
  property_id: 4,
  status: "active",
  configuration_version: 1,
  bindings_revision: 1,
  activated_at: "2026-01-01T00:00:00Z",
  revoked_at: null,
  slots: [],
};

const session = {
  session_id: "ses_1",
  user_code: "BCDF-GHJK",
  status: "pending",
  requested_at: "2026-10-08T10:00:00Z",
  expires_at: "2099-01-01T00:00:00Z",
  device: {
    hostname: "agroio-lab",
    model: "Raspberry Pi 5",
    agent_version: "2.0.0-alpha.2",
  },
  source_network: "10.32.90.0/24",
};

function renderPage(path = "/admin/gateways/pair") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <PairDevice />
    </MemoryRouter>,
  );
}

describe("PairDevice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listGateways.mockResolvedValue({ data: [pendingGateway, activeGateway] });
    mocks.getPropertyGatewayStatus.mockResolvedValue({
      data: {
        gateway_id: 9,
        status: "active",
        edge_status: "connected",
        last_heartbeat_at: "2026-10-08T09:59:00Z",
        config_version: 1,
        slots: [],
      },
    });
  });

  it("prefills the code from the URL and shows the device-reported details", async () => {
    mocks.lookupPairing.mockResolvedValue({ data: session });

    renderPage("/admin/gateways/pair?code=BCDF-GHJK");

    expect(await screen.findByText("Datos reportados por el dispositivo")).toBeInTheDocument();
    expect(mocks.lookupPairing).toHaveBeenCalledWith("BCDF-GHJK");
    expect(screen.getByText("agroio-lab")).toBeInTheDocument();
    expect(screen.getByText("Raspberry Pi 5")).toBeInTheDocument();
    expect(screen.getByText("2.0.0-alpha.2")).toBeInTheDocument();
    expect(screen.getByText("10.32.90.0/24")).toBeInTheDocument();
  });

  it("normalizes a typed code to XXXX-XXXX before looking it up", async () => {
    mocks.lookupPairing.mockResolvedValue({ data: session });

    renderPage();
    fireEvent.change(screen.getByLabelText("Código del dispositivo"), {
      target: { value: "bcdf ghjk" },
    });
    fireEvent.click(screen.getByRole("button", { name: /buscar código/i }));

    await waitFor(() => expect(mocks.lookupPairing).toHaveBeenCalledWith("BCDF-GHJK"));
    expect(screen.getByLabelText("Código del dispositivo")).toHaveValue("BCDF-GHJK");
  });

  it("keeps approve disabled until a gateway is chosen and the confirmation is ticked", async () => {
    mocks.lookupPairing.mockResolvedValue({ data: session });

    renderPage("/admin/gateways/pair?code=BCDF-GHJK");
    const approve = await screen.findByRole("button", { name: /aprobar emparejamiento/i });
    expect(approve).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Gateway"), { target: { value: "7" } });
    expect(approve).toBeDisabled();

    fireEvent.click(screen.getByLabelText(/confirmo que este código aparece/i));
    expect(approve).toBeEnabled();
  });

  it("shows one generic message when the code is unknown", async () => {
    mocks.lookupPairing.mockRejectedValueOnce({
      response: {
        status: 404,
        data: { code: "pairing_not_found", message: "Pairing session not found" },
      },
    });

    renderPage("/admin/gateways/pair?code=BCDF-GHJK");

    expect(await screen.findByTestId("pairing-not-found")).toHaveTextContent(
      /solicita un código nuevo en el dispositivo/i,
    );
  });

  it("blocks lookup when the API reports a lockout", async () => {
    mocks.lookupPairing.mockRejectedValueOnce({
      response: {
        status: 429,
        data: { code: "too_many_attempts", message: "Too many failed pairing attempts" },
      },
    });

    renderPage("/admin/gateways/pair?code=BCDF-GHJK");

    expect(await screen.findByTestId("pairing-locked")).toBeInTheDocument();
    expect(screen.getByLabelText("Código del dispositivo")).toBeDisabled();
    expect(screen.getByRole("button", { name: /buscar código/i })).toBeDisabled();
  });

  it("warns about credential replacement and approves an active gateway with replace_credential", async () => {
    mocks.lookupPairing.mockResolvedValue({ data: session });
    mocks.approvePairing.mockResolvedValue({
      data: { session_id: "ses_1", status: "approved", gateway_id: 9, property_id: 4 },
    });

    renderPage("/admin/gateways/pair?code=BCDF-GHJK");
    fireEvent.change(await screen.findByLabelText("Gateway"), { target: { value: "9" } });

    expect(await screen.findByTestId("replace-credential-warning")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/confirmo que este código aparece/i));
    fireEvent.click(screen.getByRole("button", { name: /aprobar emparejamiento/i }));

    await waitFor(() =>
      expect(mocks.approvePairing).toHaveBeenCalledWith("ses_1", {
        user_code: "BCDF-GHJK",
        gateway_id: 9,
        confirm: true,
        replace_credential: true,
      }),
    );
    expect(await screen.findByTestId("pairing-outcome")).toBeInTheDocument();
  });
});
