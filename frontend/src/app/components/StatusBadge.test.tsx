import { render, screen } from "@testing-library/react";
import { Wifi } from "lucide-react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./StatusBadge";

describe("StatusBadge", () => {
  it("shows text and a decorative icon, never color alone", () => {
    const { container } = render(<StatusBadge tone="active" icon={Wifi}>Funcionando</StatusBadge>);
    expect(screen.getByText("Funcionando")).toBeInTheDocument();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });
});
