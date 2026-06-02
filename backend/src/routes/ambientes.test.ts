import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getAmbienteBrandingBySlug: vi.fn(),
}));

vi.mock("../services/ambientes.service.js", () => ({ ...mockFns }));

async function buildApp() {
  const app = Fastify();
  const { ambientePublicRoutes } = await import("./ambientes.js");
  await app.register(ambientePublicRoutes);
  await app.ready();
  return app;
}

describe("GET /ambientes/:slug/branding", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    mockFns.getAmbienteBrandingBySlug.mockReset();
    app = await buildApp();
  });

  it("returns branding payload without auth", async () => {
    mockFns.getAmbienteBrandingBySlug.mockResolvedValue({ slug: "ia", nome: "IA" });

    const res = await app.inject({ method: "GET", url: "/ambientes/ia/branding" });

    expect(res.statusCode).toBe(200);
    expect(res.json().slug).toBe("ia");
  });

  it("returns null payload when slug is not found", async () => {
    mockFns.getAmbienteBrandingBySlug.mockResolvedValue(null);

    const res = await app.inject({ method: "GET", url: "/ambientes/missing/branding" });

    expect(res.statusCode).toBe(200);
    expect(res.json()).toBeNull();
  });

  it("returns 404 when path no longer matches route constraints", async () => {
    const longSlug = "a".repeat(121);

    const res = await app.inject({ method: "GET", url: `/ambientes/${longSlug}/branding` });

    expect(res.statusCode).toBe(404);
  });
});
