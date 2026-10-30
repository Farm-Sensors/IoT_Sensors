import { request, test as base, expect, type APIRequestContext, type Page } from "@playwright/test";
import { ADMIN, ADMIN_STATE, CLIENT_STATE } from "./users";

const API = "http://localhost:5050/api/v1/";

/** Prefijo de todo dato que crea una prueba: `E2E <timestamp>`. */
export function e2eName(label: string): string {
  return `E2E ${Date.now()} ${label}`;
}

let cachedToken: string | undefined;

/** Cliente de la API para preparar y limpiar datos; nunca para comprobar la interfaz. */
export class Api {
  constructor(private readonly ctx: APIRequestContext) {}

  private async token(): Promise<string> {
    if (!cachedToken) {
      const response = await this.ctx.post("auth/login", {
        data: { email: ADMIN.email, password: ADMIN.password },
      });
      expect(response.ok(), "login de admin por API").toBeTruthy();
      cachedToken = (await response.json()).access_token as string;
    }
    return cachedToken;
  }

  private async headers() {
    return { Authorization: `Bearer ${await this.token()}` };
  }

  async post<T = any>(path: string, data?: unknown): Promise<T> {
    const response = await this.ctx.post(path, { data, headers: await this.headers() });
    expect(response.ok(), `POST ${path} -> ${response.status()}`).toBeTruthy();
    return response.status() === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  async get<T = any>(path: string): Promise<T> {
    const response = await this.ctx.get(path, { headers: await this.headers() });
    expect(response.ok(), `GET ${path} -> ${response.status()}`).toBeTruthy();
    return (await response.json()) as T;
  }

  async remove(path: string): Promise<void> {
    await this.ctx.delete(path, { headers: await this.headers() });
  }

  /** Cliente de prueba con su usuario; devuelve el id. */
  async createClient(company: string): Promise<{ id: number }> {
    const stamp = Date.now();
    return this.post("clients", {
      email: `e2e-${stamp}@example.com`,
      password: "e2e-pass-123",
      full_name: "E2E Contacto",
      company_name: company,
    });
  }

  async createProperty(clientId: number, name: string): Promise<{ id: number }> {
    return this.post("properties", { client_id: clientId, name });
  }

  async createArea(propertyId: number, name: string): Promise<{ id: number }> {
    const cropTypes = await this.get<{ data: { id: number }[] }>("crop-types?per_page=1");
    return this.post("irrigation-areas", {
      property_id: propertyId,
      crop_type_id: cropTypes.data[0].id,
      name,
    });
  }

  /** El equipo físico canjea la referencia por su credencial (endpoint público, sin sesión). */
  async activateDevice(activationReference: string): Promise<void> {
    const response = await this.ctx.post("gateways/activate", {
      data: { activation_reference: activationReference },
    });
    expect(response.ok(), `POST gateways/activate -> ${response.status()}`).toBeTruthy();
  }

  async gatewayIdOf(propertyId: number): Promise<number> {
    const gateways = await this.get<{ id: number; property_id: number }[]>("gateways");
    const gateway = gateways.find((g) => g.property_id === propertyId);
    expect(gateway, `equipo del predio ${propertyId}`).toBeTruthy();
    return gateway!.id;
  }

  /**
   * Limpieza de un cliente de prueba por su empresa, en el orden de design.md: revoca los
   * equipos (no hay delete), borra áreas, predios y el cliente. Sin efecto si ya no existe.
   */
  async cleanupClient(company: string): Promise<void> {
    const clients = await this.get<{ data: { id: number; company_name: string }[] }>("clients?per_page=200");
    const client = clients.data.find((c) => c.company_name === company);
    if (!client) return;
    const properties = await this.get<{ data: { id: number }[] }>(`properties?client_id=${client.id}&per_page=200`);
    for (const property of properties.data) {
      await this.revokeGatewaysOf(property.id);
      const areas = await this.get<{ data: { id: number }[] }>(`irrigation-areas?property_id=${property.id}&per_page=200`);
      for (const area of areas.data) await this.remove(`irrigation-areas/${area.id}`);
      await this.remove(`properties/${property.id}`);
    }
    await this.remove(`clients/${client.id}`);
  }

  /** Gateways del predio que siguen activos, para revocarlos antes de borrar nada. */
  async revokeGatewaysOf(propertyId: number): Promise<void> {
    const gateways = await this.get<{ id: number; property_id: number; status: string }[]>("gateways");
    for (const gateway of gateways) {
      if (gateway.property_id === propertyId && gateway.status !== "revoked") {
        await this.ctx.post(`gateways/${gateway.id}/revoke`, { headers: await this.headers() });
      }
    }
  }
}

type Fixtures = { adminPage: Page; clientPage: Page; api: Api };

async function pageFromState(
  browser: import("@playwright/test").Browser,
  storageState: string,
  use: (page: Page) => Promise<void>,
) {
  const { viewport, isMobile, hasTouch, userAgent, baseURL } = base.info().project.use;
  const context = await browser.newContext({ storageState, viewport, isMobile, hasTouch, userAgent, baseURL });
  const page = await context.newPage();
  await use(page);
  await context.close();
}

export const test = base.extend<Fixtures>({
  adminPage: async ({ browser }, use) => pageFromState(browser, ADMIN_STATE, use),
  clientPage: async ({ browser }, use) => pageFromState(browser, CLIENT_STATE, use),
  api: async ({}, use) => {
    const ctx = await request.newContext({ baseURL: API });
    await use(new Api(ctx));
    await ctx.dispose();
  },
});

export { expect };
