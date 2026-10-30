import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GatewayStatusBadge } from "./GatewayStatusBadge";

describe("GatewayStatusBadge", () => {
  it("maps edge statuses to operator labels", () => {
    const { rerender } = render(<GatewayStatusBadge edgeStatus="connected" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Equipo conectado");
    rerender(<GatewayStatusBadge edgeStatus="delayed" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Equipo retrasado");
    rerender(<GatewayStatusBadge status="never_seen" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Equipo pendiente");
  });

  it("maps direct gateway model states to lifecycle labels", () => {
    const { rerender } = render(<GatewayStatusBadge status="pending_activation" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Equipo pendiente de activación");
    rerender(<GatewayStatusBadge status="active" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Equipo activo");
    rerender(<GatewayStatusBadge status="revoked" />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Equipo revocado");
  });

  it("does not render secrets", () => {
    render(<GatewayStatusBadge edgeStatus="connected" />);
    expect(screen.queryByText(/api_key|credential|gk_/i)).toBeNull();
  });

  it("pairs every state with an icon so color is never the only signal", () => {
    const { rerender } = render(<GatewayStatusBadge edgeStatus="delayed" />);
    expect(screen.getByTestId("gateway-status-badge").querySelector("svg")).not.toBeNull();
    rerender(<GatewayStatusBadge status="pending_activation" />);
    expect(screen.getByTestId("gateway-status-badge").querySelector("svg")).not.toBeNull();
    rerender(<GatewayStatusBadge />);
    expect(screen.getByTestId("gateway-status-badge")).toHaveTextContent("Equipo sin estado");
  });
});
