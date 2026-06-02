import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── vi.hoisted ────────────────────────────────────────────────────────────────

const mockFns = vi.hoisted(() => ({
  listTrabalhos: vi.fn(),
  listTrabalhosPublicos: vi.fn(),
  createTrabalho: vi.fn(),
  getTrabalhoById: vi.fn(),
  getTrabalhoPublico: vi.fn(),
  updateTrabalho: vi.fn(),
  deleteTrabalho: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class TrabalhoNotFoundError extends Error {
    constructor(id: string) {
      super(`Trabalho não encontrado: ${id}`);
      this.name = "TrabalhoNotFoundError";
    }
  }
  class TrabalhoAmbienteMismatchError extends Error {
    constructor(id: string, ambienteId: string) {
      super(`Trabalho ${id} não pertence ao ambiente ${ambienteId}`);
      this.name = "TrabalhoAmbienteMismatchError";
    }
  }
  return { TrabalhoNotFoundError, TrabalhoAmbienteMismatchError };
});

vi.mock("../../services/trabalhos.service.js", () => ({ ...mockFns, ...errors }));

// ── Middleware mocks ──────────────────────────────────────────────────────────

const mw = { auth: true, admin: true, permission: true, scope: true };

vi.mock("../../middleware/require-auth.js", () => ({
  requireAuth: vi.fn(
    async (
      req: Record<string, unknown>,
      reply: { status: (n: number) => { send: (b: unknown) => void } },
    ) => {
      if (!mw.auth)
        reply
          .status(401)
          .send({ statusCode: 401, error: "Unauthorized", message: "Não autenticado." });
      else req.user = { id: "admin-id", role: "admin" };
    },
  ),
}));

vi.mock("../../middleware/require-admin.js", () => ({
  requireAdmin: vi.fn(
    async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
      if (!mw.admin)
        reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Acesso negado." });
    },
  ),
}));

vi.mock("../../middleware/require-permission.js", () => ({
  requirePermission: vi.fn(
    () =>
      async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
        if (!mw.permission)
          reply
            .status(403)
            .send({ statusCode: 403, error: "Forbidden", message: "Permissão insuficiente." });
      },
  ),
}));

vi.mock("../../middleware/require-ambiente-scope.js", () => ({
  requireAmbienteScope: vi.fn(
    async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
      if (!mw.scope)
        reply
          .status(403)
          .send({ statusCode: 403, error: "Forbidden", message: "Sem acesso a este ambiente." });
    },
  ),
}));

vi.mock("../../services/audit.service.js", () => ({ audit: vi.fn(async () => {}) }));

// ── App builder ───────────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test-secret-min-32-chars-for-vitest" });
  await app.register(fastifyCookie);
  app.setErrorHandler((error: Error & { statusCode?: number }, _req, reply) => {
    reply
      .status(error.statusCode ?? 500)
      .send({ statusCode: error.statusCode ?? 500, error: error.name, message: error.message });
  });
  const { adminTrabalhosRoutes } = await import("./trabalhos.js");
  await app.register(adminTrabalhosRoutes);
  await app.ready();
  return app;
}

function tok(app: Awaited<ReturnType<typeof buildApp>>) {
  return (app as unknown as { jwt: { sign: (p: object) => string } }).jwt.sign({
    id: "admin-id",
    role: "admin",
  });
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AMB = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TRAB = "b2c3d4e5-f6a7-8901-bcde-f01234567891";

const fakeTrabalho = {
  id: TRAB,
  ambienteId: AMB,
  titulo: "Sistema de Gestão",
  autorNome: "Ana Silva",
  status: "publicada",
  destaque: false,
  ordem: 0,
  visualizacoes: 0,
  tags: [],
};

function reset() {
  Object.values(mockFns).forEach((fn) => fn.mockReset());
  Object.assign(mw, { auth: true, admin: true, permission: true, scope: true });
}

// ── GET /admin/ambientes/:ambienteId/trabalhos ────────────────────────────────

describe("GET /admin/ambientes/:ambienteId/trabalhos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns list of trabalhos", async () => {
    mockFns.listTrabalhos.mockResolvedValue([fakeTrabalho]);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/trabalhos`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 401 with no token", async () => {
    mw.auth = false;
    const res = await app.inject({ method: "GET", url: `/admin/ambientes/${AMB}/trabalhos` });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when scoped admin accesses another ambiente (BOLA)", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/trabalhos`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 for malformed ambienteId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/ambientes/not-uuid/trabalhos",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── POST /admin/ambientes/:ambienteId/trabalhos ───────────────────────────────

describe("POST /admin/ambientes/:ambienteId/trabalhos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("creates trabalho and returns 201", async () => {
    mockFns.createTrabalho.mockResolvedValue(fakeTrabalho);
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/trabalhos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Sistema de Gestão", autorNome: "Ana Silva" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(TRAB);
  });

  it("returns 400 for missing titulo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/trabalhos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { autorNome: "Ana Silva" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for missing autorNome", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/trabalhos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Sistema de Gestão" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for BOLA via scope middleware", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/trabalhos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X", autorNome: "Y" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── GET /admin/ambientes/:ambienteId/trabalhos/:trabalhoId ────────────────────

describe("GET /admin/ambientes/:ambienteId/trabalhos/:trabalhoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns trabalho by id", async () => {
    mockFns.getTrabalhoById.mockResolvedValue(fakeTrabalho);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(TRAB);
  });

  it("returns 404 when not found", async () => {
    mockFns.getTrabalhoById.mockRejectedValue(new errors.TrabalhoNotFoundError(TRAB));
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed trabalhoId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/trabalhos/not-uuid`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for BOLA via scope middleware", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── PUT /admin/ambientes/:ambienteId/trabalhos/:trabalhoId ────────────────────

describe("PUT /admin/ambientes/:ambienteId/trabalhos/:trabalhoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("updates trabalho and returns 200", async () => {
    mockFns.updateTrabalho.mockResolvedValue({ ...fakeTrabalho, titulo: "Novo Título" });
    const res = await app.inject({
      method: "PUT",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Novo Título", autorNome: "Ana Silva" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().titulo).toBe("Novo Título");
  });

  it("returns 404 when not found", async () => {
    mockFns.updateTrabalho.mockRejectedValue(new errors.TrabalhoNotFoundError(TRAB));
    const res = await app.inject({
      method: "PUT",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X", autorNome: "Y" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for missing required fields", async () => {
    const res = await app.inject({
      method: "PUT",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Só título" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for BOLA via scope middleware", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "PUT",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X", autorNome: "Y" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── DELETE /admin/ambientes/:ambienteId/trabalhos/:trabalhoId ─────────────────

describe("DELETE /admin/ambientes/:ambienteId/trabalhos/:trabalhoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("deletes trabalho and returns 204", async () => {
    mockFns.deleteTrabalho.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when not found", async () => {
    mockFns.deleteTrabalho.mockRejectedValue(new errors.TrabalhoNotFoundError(TRAB));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for BOLA via scope middleware", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${AMB}/trabalhos/${TRAB}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── GET /trabalhos (rota pública) ─────────────────────────────────────────────

describe("GET /trabalhos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns public trabalhos without auth", async () => {
    mockFns.listTrabalhosPublicos.mockResolvedValue([fakeTrabalho]);
    const res = await app.inject({
      method: "GET",
      url: `/trabalhos?ambienteId=${AMB}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 400 when ambienteId is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/trabalhos",
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for malformed ambienteId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/trabalhos?ambienteId=not-uuid",
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /trabalhos/:trabalhoId (rota pública) ─────────────────────────────────

describe("GET /trabalhos/:trabalhoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns single public trabalho without auth", async () => {
    mockFns.getTrabalhoPublico.mockResolvedValue(fakeTrabalho);
    const res = await app.inject({
      method: "GET",
      url: `/trabalhos/${TRAB}?ambienteId=${AMB}`,
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(TRAB);
  });

  it("returns 404 when not found or not published", async () => {
    mockFns.getTrabalhoPublico.mockRejectedValue(new errors.TrabalhoNotFoundError(TRAB));
    const res = await app.inject({
      method: "GET",
      url: `/trabalhos/${TRAB}?ambienteId=${AMB}`,
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed trabalhoId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/trabalhos/not-uuid?ambienteId=${AMB}`,
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 when ambienteId query param is missing", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/trabalhos/${TRAB}`,
    });
    expect(res.statusCode).toBe(400);
  });
});
