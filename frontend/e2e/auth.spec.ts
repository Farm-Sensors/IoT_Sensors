import { test, expect } from "@playwright/test";
import { ADMIN, CLIENT, submitLogin } from "./users";

// El login vive en `/`; tras cerrar sesión la app puede añadir `?next=<ruta anterior>`.
const LOGIN_URL = /:\d+\/(\?.*)?$/;

test.describe("Autenticación", () => {
  test("una contraseña incorrecta muestra el error y se queda en /", async ({ page }) => {
    await page.goto("/");
    await submitLogin(page, ADMIN.email, "contraseña-equivocada");
    await expect(page.getByRole("alert")).toHaveText("Credenciales inválidas");
    await expect(page).toHaveURL(LOGIN_URL);
  });

  test("el admin entra a /admin y sale al login", async ({ page }) => {
    await page.goto("/");
    await submitLogin(page, ADMIN.email, ADMIN.password);
    await page.waitForURL(ADMIN.landing);
    await expect(page.getByRole("heading", { level: 1, name: "Panel de Administración" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(LOGIN_URL);
    await expect(page.getByRole("heading", { name: "Bienvenido de vuelta" })).toBeVisible();
  });

  test("el cliente entra a /cliente y sale al login", async ({ page }) => {
    await page.goto("/");
    await submitLogin(page, CLIENT.email, CLIENT.password);
    await page.waitForURL(CLIENT.landing);
    await expect(page.getByRole("heading", { level: 1, name: /^Hola, / })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(LOGIN_URL);
    await expect(page.getByRole("heading", { name: "Bienvenido de vuelta" })).toBeVisible();
  });
});
