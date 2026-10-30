import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PageHeader } from "./PageHeader";

describe("PageHeader", () => {
  it("renders a single h1 with the subtitle and the action", () => {
    render(<PageHeader title="Mi Perfil" subtitle="Tu información" action={<button>Editar</button>} />);
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Mi Perfil");
    expect(screen.getByText("Tu información")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeInTheDocument();
  });

  it("makes the heading focusable by code so focus can move to it", () => {
    render(<PageHeader title="Paso 2" />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveAttribute("tabindex", "-1");
  });
});
