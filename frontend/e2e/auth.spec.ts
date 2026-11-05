import { test, expect, type Page } from "@playwright/test";
import { ADMIN, CLIENT, submitLogin } from "./users";

// El login vive en `/`; tras cerrar sesión la app puede añadir `?next=<ruta anterior>`.
const LOGIN_URL = /:\d+\/(\?.*)?$/;

// El título del acceso es un saludo que cambia en cada visita (LoginPage `loginGreetings`): se comprueba el formulario.
async function expectLoginForm(page: Page) {
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByLabel("Correo Electrónico")).toBeVisible();
  await expect(page.getByRole("button", { name: "Iniciar Sesión" })).toBeVisible();
}

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
    await expect(page.getByRole("heading", { level: 1, name: "Inicio" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(LOGIN_URL);
    await expectLoginForm(page);
  });

  test("el cliente entra a /cliente y sale al login", async ({ page }) => {
    await page.goto("/");
    await submitLogin(page, CLIENT.email, CLIENT.password);
    await page.waitForURL(CLIENT.landing);
    // La portada del productor es «Mis predios» (rediseño v2).
    await expect(page.getByRole("heading", { level: 1, name: "Mis predios" })).toBeVisible();
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(LOGIN_URL);
    await expectLoginForm(page);
  });
});
