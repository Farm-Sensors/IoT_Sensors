import type { Page } from "@playwright/test";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const AUTH_DIR = join(fileURLToPath(new URL(".", import.meta.url)), ".auth");
export const ADMIN_STATE = join(AUTH_DIR, "admin.json");
export const CLIENT_STATE = join(AUTH_DIR, "client.json");

export const ADMIN = { email: "admin@sensores.com", password: "admin123", landing: "**/admin" };
export const CLIENT = { email: "alan2203mx@gmail.com", password: "123", landing: "**/cliente" };

/** Llena y envía el formulario de `/` (labels de pages/auth/LoginPage.tsx). */
export async function submitLogin(page: Page, email: string, password: string) {
  await page.getByLabel("Correo Electrónico").fill(email);
  await page.getByLabel("Contraseña", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Iniciar Sesión" }).click();
}
