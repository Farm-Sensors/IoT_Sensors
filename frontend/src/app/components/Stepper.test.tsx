import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Stepper } from "./Stepper";

describe("Stepper", () => {
  it("marks only the current step and says the progress in text", () => {
    render(<Stepper steps={["Rancho y áreas", "Vincular equipo", "Asignar nodos"]} current={1} />);
    expect(screen.getByText("Paso 2 de 3")).toBeInTheDocument();
    const items = screen.getAllByRole("listitem");
    expect(items[1]).toHaveAttribute("aria-current", "step");
    expect(items[0]).not.toHaveAttribute("aria-current");
    expect(items[0]).toHaveTextContent("completado");
    expect(items[2]).not.toHaveAttribute("aria-current");
  });
});
