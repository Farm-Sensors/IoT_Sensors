import { chromium, type FullConfig } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { ADMIN, ADMIN_STATE, AUTH_DIR, CLIENT, CLIENT_STATE, submitLogin } from "./users";

async function isUp(url: string): Promise<boolean> {
  try {
    const response = await fetch(url);
    return response.ok;
  } catch {
    return false;
  }
}

async function loginAndSave(baseURL: string, user: typeof ADMIN, path: string) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(baseURL);
    await submitLogin(page, user.email, user.password);
    await page.waitForURL(user.landing);
    await page.context().storageState({ path });
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(config: FullConfig) {
  const baseURL = config.projects[0].use.baseURL ?? "http://localhost:5173";
  const up = (await isUp("http://localhost:5050/health")) && (await isUp(`${baseURL}/`));
  if (!up) {
    throw new Error("Levanta el stack local con make dev");
  }
  mkdirSync(AUTH_DIR, { recursive: true });
  await loginAndSave(baseURL, ADMIN, ADMIN_STATE);
  await loginAndSave(baseURL, CLIENT, CLIENT_STATE);
}
