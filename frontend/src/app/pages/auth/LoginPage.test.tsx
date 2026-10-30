import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginPage } from "./LoginPage";

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock("../../services/api", () => ({ api: { post: mocks.post } }));
vi.mock("../../context/AuthContext", () => ({
  useAuth: () => ({ login: vi.fn(), isAuthenticated: false, user: null }),
}));
vi.mock("../../context/ThemeContext", () => ({ useTheme: () => ({ theme: "light", toggleTheme: vi.fn() }) }));

afterEach(() => {
  cleanup();
  mocks.post.mockReset();
});

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

describe("LoginPage", () => {
  it("has a single visible h1 (the form title)", () => {
    renderLogin();
    const headings = screen.getAllByRole("heading", { level: 1 });
    expect(headings).toHaveLength(1);
    expect(headings[0]).toHaveTextContent("Bienvenido de vuelta");
  });

  it("announces a wrong-credentials error and moves focus to the password field", async () => {
    mocks.post.mockRejectedValue({ response: { data: { detail: "Credenciales inválidas" } } });
    renderLogin();
    fireEvent.change(screen.getByLabelText("Correo electrónico"), { target: { value: "a@b.mx" } });
    fireEvent.change(screen.getByLabelText("Contraseña"), { target: { value: "mala" } });
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Sesión" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Credenciales inválidas");
    await waitFor(() => expect(screen.getByLabelText("Contraseña")).toHaveFocus());
    expect(screen.getByLabelText("Contraseña")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Correo electrónico")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Contraseña")).toHaveAccessibleDescription("Credenciales inválidas");
  });

  it("focuses the email field when it is empty", async () => {
    mocks.post.mockRejectedValue({ response: { data: { detail: "Credenciales inválidas" } } });
    renderLogin();
    fireEvent.click(screen.getByRole("button", { name: "Iniciar Sesión" }));
    await screen.findByRole("alert");
    await waitFor(() => expect(screen.getByLabelText("Correo electrónico")).toHaveFocus());
  });
});
