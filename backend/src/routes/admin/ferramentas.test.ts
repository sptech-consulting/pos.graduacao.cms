import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── vi.hoisted ────────────────────────────────────────────────────────────────

const mockFns = vi.hoisted(() => ({
  listFerramentas: vi.fn(),
  createFerramenta: vi.fn(),
  getFerramentaById: vi.fn(),
  updateFerramenta: vi.fn(),
  deleteFerramenta: vi.fn(),
  addCasoUso: vi.fn(),
  removeCasoUso: vi.fn(),
  addTag: vi.fn(),
  removeTag: vi.fn(),
  addBloco: vi.fn(),
  removeBloco: vi.fn(),
  addFuncionalidade: vi.fn(),
  removeFuncionalidade: vi.fn(),
  addCasoTeste: vi.fn(),
  removeCasoTeste: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class FerramentaNotFoundError extends Error {
    constructor(id: string) {
      super(`Ferramenta não encontrada: ${id}`);
      this.name = "FerramentaNotFoundError";
    }
  }
  class SubRecursoNotFoundError extends Error {
    constructor(tipo: string, id: string) {
      super(`${tipo} não encontrado: ${id}`);
      this.name = "SubRecursoNotFoundError";
    }
  }
  return { FerramentaNotFoundError, SubRecursoNotFoundError };
});

vi.mock("../../services/ferramentas.service.js", () => ({ ...mockFns, ...errors }));

// ── Middleware mocks ──────────────────────────────────────────────────────────

const mw = { auth: true, admin: true, permission: true };

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
  const { adminFerramentasRoutes } = await import("./ferramentas.js");
  await app.register(adminFerramentasRoutes);
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

const UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ITEM_UUID = "b2c3d4e5-f6a7-8901-bcde-f01234567891";

const fakeFerramenta = {
  id: UUID,
  nome: "ChatGPT",
  status: "ativo",
  casosUso: [],
  tags: [],
  blocos: [],
  funcionalidades: [],
  casosTeste: [],
};
const fakeCasoUso = { id: ITEM_UUID, ferramentaId: UUID, texto: "Gerar código", ordem: 0 };
const fakeTag = { id: ITEM_UUID, ferramentaId: UUID, tipo: "input", rotulo: "Texto", ordem: 0 };
const fakeBloco = { id: ITEM_UUID, ferramentaId: UUID, titulo: "B1", conteudo: "...", ordem: 0 };
const fakeFunc = { id: ITEM_UUID, ferramentaId: UUID, titulo: "F1", ordem: 0 };
const fakeCasoTeste = { id: ITEM_UUID, ferramentaId: UUID, titulo: "CT1", ordem: 0 };

function reset() {
  Object.values(mockFns).forEach((fn) => fn.mockReset());
  Object.assign(mw, { auth: true, admin: true, permission: true });
}

// ── GET /admin/ferramentas ────────────────────────────────────────────────────

describe("GET /admin/ferramentas", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns list", async () => {
    mockFns.listFerramentas.mockResolvedValue([fakeFerramenta]);
    const res = await app.inject({
      method: "GET",
      url: "/admin/ferramentas",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 401 with no token", async () => {
    mw.auth = false;
    const res = await app.inject({ method: "GET", url: "/admin/ferramentas" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for missing permission", async () => {
    mw.permission = false;
    const res = await app.inject({
      method: "GET",
      url: "/admin/ferramentas",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── POST /admin/ferramentas ───────────────────────────────────────────────────

describe("POST /admin/ferramentas", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("creates ferramenta and returns 201", async () => {
    mockFns.createFerramenta.mockResolvedValue(fakeFerramenta);
    const res = await app.inject({
      method: "POST",
      url: "/admin/ferramentas",
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nome: "ChatGPT" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().nome).toBe("ChatGPT");
  });

  it("returns 400 for missing nome", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/ferramentas",
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { url: "https://example.com" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for invalid tipoAbertura", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/ferramentas",
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nome: "X", tipoAbertura: "invalido" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /admin/ferramentas/:ferramentaId ──────────────────────────────────────

describe("GET /admin/ferramentas/:ferramentaId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns ferramenta with sub-recursos", async () => {
    mockFns.getFerramentaById.mockResolvedValue(fakeFerramenta);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ferramentas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(UUID);
  });

  it("returns 404 when not found", async () => {
    mockFns.getFerramentaById.mockResolvedValue(null);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ferramentas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/ferramentas/not-uuid",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /admin/ferramentas/:ferramentaId ────────────────────────────────────

describe("PATCH /admin/ferramentas/:ferramentaId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("updates and returns 200", async () => {
    mockFns.updateFerramenta.mockResolvedValue({ ...fakeFerramenta, nome: "GPT-4" });
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ferramentas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nome: "GPT-4" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nome).toBe("GPT-4");
  });

  it("returns 404 when not found", async () => {
    mockFns.updateFerramenta.mockRejectedValue(new errors.FerramentaNotFoundError(UUID));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ferramentas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nome: "X" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for missing permission", async () => {
    mw.permission = false;
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ferramentas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nome: "X" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── DELETE /admin/ferramentas/:ferramentaId ───────────────────────────────────

describe("DELETE /admin/ferramentas/:ferramentaId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("deletes and returns 204", async () => {
    mockFns.deleteFerramenta.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when not found", async () => {
    mockFns.deleteFerramenta.mockRejectedValue(new errors.FerramentaNotFoundError(UUID));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── POST /admin/ferramentas/:ferramentaId/casos-uso ───────────────────────────

describe("POST /admin/ferramentas/:ferramentaId/casos-uso", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("adds caso de uso and returns 201", async () => {
    mockFns.addCasoUso.mockResolvedValue(fakeCasoUso);
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/casos-uso`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { texto: "Gerar código", ordem: 0 },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().texto).toBe("Gerar código");
  });

  it("returns 400 for missing texto", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/casos-uso`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { ordem: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when ferramenta does not exist", async () => {
    mockFns.addCasoUso.mockRejectedValue(new errors.FerramentaNotFoundError(UUID));
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/casos-uso`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { texto: "X", ordem: 0 },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── DELETE /admin/ferramentas/:ferramentaId/casos-uso/:itemId ─────────────────

describe("DELETE /admin/ferramentas/:ferramentaId/casos-uso/:itemId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("removes and returns 204", async () => {
    mockFns.removeCasoUso.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/casos-uso/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for IDOR attempt (item belongs to different ferramenta)", async () => {
    mockFns.removeCasoUso.mockRejectedValue(
      new errors.SubRecursoNotFoundError("caso_uso", ITEM_UUID),
    );
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/casos-uso/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed itemId", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/casos-uso/not-uuid`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── POST /admin/ferramentas/:ferramentaId/tags ────────────────────────────────

describe("POST /admin/ferramentas/:ferramentaId/tags", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("adds tag and returns 201", async () => {
    mockFns.addTag.mockResolvedValue(fakeTag);
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/tags`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { tipo: "input", rotulo: "Texto", ordem: 0 },
    });
    expect(res.statusCode).toBe(201);
  });

  it("returns 400 for invalid tipo enum", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/tags`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { tipo: "invalido", rotulo: "X", ordem: 0 },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for missing rotulo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/tags`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { tipo: "input", ordem: 0 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /admin/ferramentas/:ferramentaId/tags/:itemId ──────────────────────

describe("DELETE /admin/ferramentas/:ferramentaId/tags/:itemId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("removes and returns 204", async () => {
    mockFns.removeTag.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/tags/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for IDOR attempt", async () => {
    mockFns.removeTag.mockRejectedValue(new errors.SubRecursoNotFoundError("tag", ITEM_UUID));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/tags/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── POST /admin/ferramentas/:ferramentaId/blocos ──────────────────────────────

describe("POST /admin/ferramentas/:ferramentaId/blocos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("adds bloco and returns 201", async () => {
    mockFns.addBloco.mockResolvedValue(fakeBloco);
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/blocos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "B1", conteudo: "Conteúdo", ordem: 0 },
    });
    expect(res.statusCode).toBe(201);
  });

  it("returns 400 for missing conteudo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/blocos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "B1", ordem: 0 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /admin/ferramentas/:ferramentaId/blocos/:itemId ────────────────────

describe("DELETE /admin/ferramentas/:ferramentaId/blocos/:itemId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("removes and returns 204", async () => {
    mockFns.removeBloco.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/blocos/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for IDOR attempt", async () => {
    mockFns.removeBloco.mockRejectedValue(new errors.SubRecursoNotFoundError("bloco", ITEM_UUID));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/blocos/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── POST /admin/ferramentas/:ferramentaId/funcionalidades ─────────────────────

describe("POST /admin/ferramentas/:ferramentaId/funcionalidades", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("adds funcionalidade and returns 201", async () => {
    mockFns.addFuncionalidade.mockResolvedValue(fakeFunc);
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/funcionalidades`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "F1", ordem: 0 },
    });
    expect(res.statusCode).toBe(201);
  });

  it("returns 400 for missing titulo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/funcionalidades`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { ordem: 0 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /admin/ferramentas/:ferramentaId/funcionalidades/:itemId ───────────

describe("DELETE /admin/ferramentas/:ferramentaId/funcionalidades/:itemId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("removes and returns 204", async () => {
    mockFns.removeFuncionalidade.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/funcionalidades/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for IDOR attempt", async () => {
    mockFns.removeFuncionalidade.mockRejectedValue(
      new errors.SubRecursoNotFoundError("funcionalidade", ITEM_UUID),
    );
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/funcionalidades/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── POST /admin/ferramentas/:ferramentaId/casos-teste ─────────────────────────

describe("POST /admin/ferramentas/:ferramentaId/casos-teste", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("adds caso de teste and returns 201", async () => {
    mockFns.addCasoTeste.mockResolvedValue(fakeCasoTeste);
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/casos-teste`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "CT1", ordem: 0 },
    });
    expect(res.statusCode).toBe(201);
  });

  it("returns 400 for missing titulo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ferramentas/${UUID}/casos-teste`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { badge: "X" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /admin/ferramentas/:ferramentaId/casos-teste/:itemId ───────────────

describe("DELETE /admin/ferramentas/:ferramentaId/casos-teste/:itemId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("removes and returns 204", async () => {
    mockFns.removeCasoTeste.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/casos-teste/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 for IDOR attempt", async () => {
    mockFns.removeCasoTeste.mockRejectedValue(
      new errors.SubRecursoNotFoundError("caso_teste", ITEM_UUID),
    );
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/casos-teste/${ITEM_UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed itemId", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ferramentas/${UUID}/casos-teste/not-uuid`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});
