import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── vi.hoisted — runs before vi.mock factories, safe to reference in factories ──

const mockFns = vi.hoisted(() => ({
  createAmbiente: vi.fn(),
  listAmbientes: vi.fn(),
  getAmbienteById: vi.fn(),
  updateAmbiente: vi.fn(),
  updateAmbienteStatus: vi.fn(),
  deleteAmbiente: vi.fn(),
}));

const errorClasses = vi.hoisted(() => {
  class SlugConflictError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "SlugConflictError";
    }
  }
  class AmbienteNotFoundError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "AmbienteNotFoundError";
    }
  }
  class AmbienteHasActiveMembersError extends Error {
    constructor(msg: string) {
      super(msg);
      this.name = "AmbienteHasActiveMembersError";
    }
  }
  return { SlugConflictError, AmbienteNotFoundError, AmbienteHasActiveMembersError };
});

// ── Service mock ──────────────────────────────────────────────────────────────

vi.mock("../../services/ambientes.service.js", () => ({
  ...mockFns,
  ...errorClasses,
}));

// ── Middleware mocks — toggled per test ───────────────────────────────────────

const middlewareState = {
  requireAuth: true,
  requireAdmin: true,
  requirePermission: true,
  requireAmbienteScope: true,
};

vi.mock("../../middleware/require-auth.js", () => ({
  requireAuth: vi.fn(
    async (
      req: Record<string, unknown>,
      reply: { status: (n: number) => { send: (b: unknown) => void } },
    ) => {
      if (!middlewareState.requireAuth) {
        reply
          .status(401)
          .send({ statusCode: 401, error: "Unauthorized", message: "Não autenticado." });
      } else {
        // Populate req.user so route handlers can access req.user.id
        req.user = { id: "admin-id", role: "admin" };
      }
    },
  ),
}));

vi.mock("../../middleware/require-admin.js", () => ({
  requireAdmin: vi.fn(
    async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
      if (!middlewareState.requireAdmin)
        reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Acesso negado." });
    },
  ),
}));

vi.mock("../../middleware/require-permission.js", () => ({
  requirePermission: vi.fn(
    () =>
      async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
        if (!middlewareState.requirePermission)
          reply
            .status(403)
            .send({ statusCode: 403, error: "Forbidden", message: "Permissão insuficiente." });
      },
  ),
}));

vi.mock("../../middleware/require-ambiente-scope.js", () => ({
  requireAmbienteScope: vi.fn(
    async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
      if (!middlewareState.requireAmbienteScope)
        reply
          .status(403)
          .send({ statusCode: 403, error: "Forbidden", message: "Sem acesso a este ambiente." });
    },
  ),
}));

vi.mock("../../services/audit.service.js", () => ({
  audit: vi.fn(async () => {}),
}));

// ── Test app builder ──────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test-secret-min-32-chars-for-vitest" });
  await app.register(fastifyCookie);

  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    const statusCode = error.statusCode ?? 500;
    reply.status(statusCode).send({
      statusCode,
      error: error.name ?? "Internal Server Error",
      message: error.message,
    });
  });

  const { adminAmbientesRoutes } = await import("./ambientes.js");
  await app.register(adminAmbientesRoutes);
  await app.ready();
  return app;
}

function makeToken(
  app: Awaited<ReturnType<typeof buildApp>>,
  payload = { id: "admin-id", role: "admin" },
) {
  return (app as unknown as { jwt: { sign: (p: object) => string } }).jwt.sign(payload);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validUuid = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

const fakeAmbiente = {
  id: validUuid,
  nome: "Pós Tech",
  slug: "pos-tech",
  status: "ativo",
  tema: "claro",
  criadoEm: new Date().toISOString(),
  atualizadoEm: new Date().toISOString(),
};

const validBody = { nome: "Pós Tech", slug: "pos-tech" };

function resetMiddleware() {
  Object.assign(middlewareState, {
    requireAuth: true,
    requireAdmin: true,
    requirePermission: true,
    requireAmbienteScope: true,
  });
}

// ── GET /admin/ambientes ──────────────────────────────────────────────────────

describe("GET /admin/ambientes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    Object.values(mockFns).forEach((fn) => fn.mockReset());
    resetMiddleware();
    app = await buildApp();
  });

  it("returns list of ambientes for authorized admin", async () => {
    mockFns.listAmbientes.mockResolvedValue([fakeAmbiente]);
    const res = await app.inject({
      method: "GET",
      url: "/admin/ambientes",
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 401 with no token", async () => {
    middlewareState.requireAuth = false;
    const res = await app.inject({ method: "GET", url: "/admin/ambientes" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for non-admin (aluno role)", async () => {
    middlewareState.requireAdmin = false;
    const res = await app.inject({
      method: "GET",
      url: "/admin/ambientes",
      headers: { authorization: `Bearer ${makeToken(app, { id: "aluno-id", role: "aluno" })}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when admin lacks ambientes.visualizar permission", async () => {
    middlewareState.requirePermission = false;
    const res = await app.inject({
      method: "GET",
      url: "/admin/ambientes",
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── POST /admin/ambientes ─────────────────────────────────────────────────────

describe("POST /admin/ambientes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    Object.values(mockFns).forEach((fn) => fn.mockReset());
    resetMiddleware();
    app = await buildApp();
  });

  it("creates ambiente and returns 201", async () => {
    mockFns.createAmbiente.mockResolvedValue(fakeAmbiente);
    const res = await app.inject({
      method: "POST",
      url: "/admin/ambientes",
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: validBody,
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().slug).toBe("pos-tech");
  });

  it("returns 409 when slug is already taken", async () => {
    mockFns.createAmbiente.mockRejectedValue(new errorClasses.SlugConflictError("pos-tech"));
    const res = await app.inject({
      method: "POST",
      url: "/admin/ambientes",
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: validBody,
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 400 for missing required field nome", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/ambientes",
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { slug: "pos-tech" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for missing required field slug", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/ambientes",
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { nome: "Pós Tech" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("strips extra fields — webhookToken never reaches the service (mass-assignment protection)", async () => {
    // Fastify/AJV uses removeAdditional:true by default — unknown fields are stripped,
    // not rejected. What matters is that the service never sees them.
    mockFns.createAmbiente.mockResolvedValue(fakeAmbiente);
    const res = await app.inject({
      method: "POST",
      url: "/admin/ambientes",
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { ...validBody, webhookToken: "hacked" },
    });
    expect(res.statusCode).toBe(201);
    const calledWithBody = mockFns.createAmbiente.mock.calls[0]?.[0];
    expect(calledWithBody).not.toHaveProperty("webhookToken");
  });

  it("returns 401 with no token", async () => {
    middlewareState.requireAuth = false;
    // Include a valid body — schema validation runs before middleware,
    // so a missing body would trigger 400 before auth can return 401.
    const res = await app.inject({ method: "POST", url: "/admin/ambientes", payload: validBody });
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /admin/ambientes/:ambienteId ──────────────────────────────────────────

describe("GET /admin/ambientes/:ambienteId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    Object.values(mockFns).forEach((fn) => fn.mockReset());
    resetMiddleware();
    app = await buildApp();
  });

  it("returns ambiente by id", async () => {
    mockFns.getAmbienteById.mockResolvedValue(fakeAmbiente);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(validUuid);
  });

  it("returns 404 when ambiente not found", async () => {
    mockFns.getAmbienteById.mockResolvedValue(null);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/ambientes/not-a-uuid",
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 when scoped admin accesses another ambiente (BOLA)", async () => {
    middlewareState.requireAmbienteScope = false;
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── PATCH /admin/ambientes/:ambienteId ────────────────────────────────────────

describe("PATCH /admin/ambientes/:ambienteId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    Object.values(mockFns).forEach((fn) => fn.mockReset());
    resetMiddleware();
    app = await buildApp();
  });

  it("updates ambiente and returns 200", async () => {
    mockFns.updateAmbiente.mockResolvedValue({ ...fakeAmbiente, nome: "Novo Nome" });
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { nome: "Novo Nome" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nome).toBe("Novo Nome");
  });

  it("returns 404 when ambiente not found", async () => {
    mockFns.updateAmbiente.mockRejectedValue(new errorClasses.AmbienteNotFoundError(validUuid));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { nome: "Novo Nome" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 when new slug is already taken", async () => {
    mockFns.updateAmbiente.mockRejectedValue(new errorClasses.SlugConflictError("taken"));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { slug: "taken" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("strips extra fields — criadoEm never reaches the service (mass-assignment protection)", async () => {
    // Fastify/AJV strips unknown fields silently. The service must not receive criadoEm.
    mockFns.updateAmbiente.mockResolvedValue(fakeAmbiente);
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { nome: "Novo Nome", criadoEm: "2020-01-01" },
    });
    expect(res.statusCode).toBe(200);
    const calledWithPatch = mockFns.updateAmbiente.mock.calls[0]?.[1];
    expect(calledWithPatch).not.toHaveProperty("criadoEm");
  });

  it("returns 403 when scoped admin edits another ambiente (BOLA)", async () => {
    middlewareState.requireAmbienteScope = false;
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { nome: "Hack" },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/admin/ambientes/not-a-uuid",
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { nome: "X" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /admin/ambientes/:ambienteId/status ─────────────────────────────────

describe("PATCH /admin/ambientes/:ambienteId/status", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    Object.values(mockFns).forEach((fn) => fn.mockReset());
    resetMiddleware();
    app = await buildApp();
  });

  it("updates status and returns 204", async () => {
    mockFns.updateAmbienteStatus.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}/status`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { status: "inativo" },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}/status`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { status: "deletado" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when ambiente not found", async () => {
    mockFns.updateAmbienteStatus.mockRejectedValue(
      new errorClasses.AmbienteNotFoundError(validUuid),
    );
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}/status`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { status: "inativo" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when scoped admin changes status of another ambiente (BOLA)", async () => {
    middlewareState.requireAmbienteScope = false;
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${validUuid}/status`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
      payload: { status: "inativo" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── DELETE /admin/ambientes/:ambienteId ───────────────────────────────────────

describe("DELETE /admin/ambientes/:ambienteId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    Object.values(mockFns).forEach((fn) => fn.mockReset());
    resetMiddleware();
    app = await buildApp();
  });

  it("deletes ambiente and returns 204", async () => {
    mockFns.deleteAmbiente.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when ambiente not found", async () => {
    mockFns.deleteAmbiente.mockRejectedValue(new errorClasses.AmbienteNotFoundError(validUuid));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 when ambiente has active alunos", async () => {
    mockFns.deleteAmbiente.mockRejectedValue(
      new errorClasses.AmbienteHasActiveMembersError(validUuid),
    );
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 403 when scoped admin deletes another ambiente (BOLA)", async () => {
    middlewareState.requireAmbienteScope = false;
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${validUuid}`,
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/admin/ambientes/not-a-uuid",
      headers: { authorization: `Bearer ${makeToken(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});
