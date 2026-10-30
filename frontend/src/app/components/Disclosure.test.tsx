import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Disclosure } from "./Disclosure";

describe("Disclosure", () => {
  it("starts closed and toggles with aria-expanded", () => {
    render(<Disclosure summary="Datos para soporte">ID 42</Disclosure>);
    const trigger = screen.getByRole("button", { name: "Datos para soporte" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("ID 42")).toBeNull();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText("ID 42")).toBeInTheDocument();

    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "false");
  });
});
