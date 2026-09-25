import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GatewayStatusBadge } from "./GatewayStatusBadge";

describe("GatewayStatusBadge", () => {
  it("maps edge statuses to operator labels", () => {
    const { rerender } = render(<GatewayStatusBadge edgeStatus="connected" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Gateway conectado");
    rerender(<GatewayStatusBadge edgeStatus="delayed" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Gateway retrasado");
    rerender(<GatewayStatusBadge status="never_seen" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Gateway pendiente");
  });

  it("does not render secrets", () => {
    render(<GatewayStatusBadge edgeStatus="connected" />);
    expect(screen.queryByText(/api_key|credential|gk_/i)).toBeNull();
  });
});
