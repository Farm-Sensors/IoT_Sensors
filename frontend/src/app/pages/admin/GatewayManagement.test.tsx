import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { GatewayManagement } from "./GatewayManagement";

vi.mock("../../components/Toast", () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

vi.mock("../../services/gateways", () => ({
  listGateways: vi.fn().mockResolvedValue({
    data: [{ id: 7, property_id: 3, status: "active", configuration_version: 1, bindings_revision: 1, activated_at: null, revoked_at: null, slots: [] }],
  }),
  provisionGateway: vi.fn(),
  issueActivationReference: vi.fn().mockResolvedValue({
    data: { activation_reference: "ar_once", expires_at: "2026-09-25T00:00:00Z" },
  }),
  publishConfiguration: vi.fn(),
}));

describe("GatewayManagement", () => {
  it("shows gateway status and can reveal a one-time reference without keeping api keys", async () => {
    render(<GatewayManagement />);
    expect(await screen.findByText(/Gateway #7/)).toBeInTheDocument();
    expect(screen.getByTestId("gateway-status-badge")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /activación/i }));
    expect(await screen.findByTestId("one-time-secret")).toHaveTextContent("ar_once");
    expect(screen.queryByText(/api_key/i)).toBeNull();
  });
});
