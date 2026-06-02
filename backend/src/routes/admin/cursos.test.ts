import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── vi.hoisted ────────────────────────────────────────────────────────────────

const mockFns = vi.hoisted(() => ({
  createCurso: vi.fn(),
  listCursos: vi.fn(),
  getCursoById: vi.fn(),
  updateCurso: vi.fn(),
  deleteCurso: vi.fn(),
  createModulo: vi.fn(),
  listModulosByCurso: vi.fn(),
  updateModulo: vi.fn(),
  deleteModulo: vi.fn(),
  createAula: vi.fn(),
  listAulasByModulo: vi.fn(),
  updateAula: vi.fn(),
  deleteAula: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class CursoNotFoundError extends Error {
    constructor(id: string) {
      super(`Curso não encontrado: ${id}`);
      this.name = "CursoNotFoundError";
    }
  }
  class ModuloNotFoundError extends Error {
    constructor(id: string) {
      super(`Módulo não encontrado: ${id}`);
      this.name = "ModuloNotFoundError";
    }
  }
  class AulaNotFoundError extends Error {
    constructor(id: string) {
      super(`Aula não encontrada: ${id}`);
      this.name = "AulaNotFoundError";
    }
  }
  class CursoHasModulosError extends Error {
    constructor(id: string) {
      super(`Curso possui módulos: ${id}`);
      this.name = "CursoHasModulosError";
    }
  }
  class ModuloHasAulasError extends Error {
    constructor(id: string) {
      super(`Módulo possui aulas: ${id}`);
      this.name = "ModuloHasAulasError";
    }
  }
  return {
    CursoNotFoundError,
    ModuloNotFoundError,
    AulaNotFoundError,
    CursoHasModulosError,
    ModuloHasAulasError,
  };
});

vi.mock("../../services/cursos.service.js", () => ({ ...mockFns, ...errors }));

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
    reply.status(error.statusCode ?? 500).send({
      statusCode: error.statusCode ?? 500,
      error: error.name,
      message: error.message,
    });
  });
  const { adminCursosRoutes } = await import("./cursos.js");
  await app.register(adminCursosRoutes);
  await app.ready();
  return app;
}

function tok(
  app: Awaited<ReturnType<typeof buildApp>>,
  payload = { id: "admin-id", role: "admin" },
) {
  return (app as unknown as { jwt: { sign: (p: object) => string } }).jwt.sign(payload);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const UUID2 = "b2c3d4e5-f6a7-8901-bcde-f01234567891";

const fakeCurso = { id: UUID, titulo: "React Avançado", status: "rascunho" };
const fakeModulo = { id: UUID2, cursoId: UUID, titulo: "Módulo 1", ordem: 0, status: "ativo" };
const fakeAula = { id: UUID, moduloId: UUID2, titulo: "Aula 1", ordem: 0, status: "rascunho" };

function reset() {
  Object.values(mockFns).forEach((fn) => fn.mockReset());
  Object.assign(mw, { auth: true, admin: true, permission: true });
}

// ── GET /admin/cursos ─────────────────────────────────────────────────────────

describe("GET /admin/cursos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns list", async () => {
    mockFns.listCursos.mockResolvedValue([fakeCurso]);
    const res = await app.inject({
      method: "GET",
      url: "/admin/cursos",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 401 with no token", async () => {
    mw.auth = false;
    const res = await app.inject({ method: "GET", url: "/admin/cursos" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for non-admin", async () => {
    mw.admin = false;
    const res = await app.inject({
      method: "GET",
      url: "/admin/cursos",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 for missing permission", async () => {
    mw.permission = false;
    const res = await app.inject({
      method: "GET",
      url: "/admin/cursos",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── POST /admin/cursos ────────────────────────────────────────────────────────

describe("POST /admin/cursos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("creates curso and returns 201", async () => {
    mockFns.createCurso.mockResolvedValue(fakeCurso);
    const res = await app.inject({
      method: "POST",
      url: "/admin/cursos",
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "React Avançado" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().titulo).toBe("React Avançado");
  });

  it("returns 400 for missing titulo", async () => {
    const res = await app.inject({
      method: "POST",
      url: "/admin/cursos",
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { descricao: "sem titulo" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 401 with no token", async () => {
    mw.auth = false;
    const res = await app.inject({
      method: "POST",
      url: "/admin/cursos",
      payload: { titulo: "X" },
    });
    expect(res.statusCode).toBe(401);
  });
});

// ── GET /admin/cursos/:cursoId ────────────────────────────────────────────────

describe("GET /admin/cursos/:cursoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns curso by id", async () => {
    mockFns.getCursoById.mockResolvedValue(fakeCurso);
    const res = await app.inject({
      method: "GET",
      url: `/admin/cursos/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(UUID);
  });

  it("returns 404 when not found", async () => {
    mockFns.getCursoById.mockResolvedValue(null);
    const res = await app.inject({
      method: "GET",
      url: `/admin/cursos/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/cursos/not-a-uuid",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /admin/cursos/:cursoId ──────────────────────────────────────────────

describe("PATCH /admin/cursos/:cursoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("updates and returns 200", async () => {
    mockFns.updateCurso.mockResolvedValue({ ...fakeCurso, titulo: "Atualizado" });
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/cursos/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Atualizado" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().titulo).toBe("Atualizado");
  });

  it("returns 404 when not found", async () => {
    mockFns.updateCurso.mockRejectedValue(new errors.CursoNotFoundError(UUID));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/cursos/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/admin/cursos/not-a-uuid",
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 403 for missing permission", async () => {
    mw.permission = false;
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/cursos/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── DELETE /admin/cursos/:cursoId ─────────────────────────────────────────────

describe("DELETE /admin/cursos/:cursoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("deletes and returns 204", async () => {
    mockFns.deleteCurso.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/cursos/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when not found", async () => {
    mockFns.deleteCurso.mockRejectedValue(new errors.CursoNotFoundError(UUID));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/cursos/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 when curso has modules", async () => {
    mockFns.deleteCurso.mockRejectedValue(new errors.CursoHasModulosError(UUID));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/cursos/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/admin/cursos/not-a-uuid",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /admin/cursos/:cursoId/modulos ────────────────────────────────────────

describe("GET /admin/cursos/:cursoId/modulos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns modules for curso", async () => {
    mockFns.listModulosByCurso.mockResolvedValue([fakeModulo]);
    const res = await app.inject({
      method: "GET",
      url: `/admin/cursos/${UUID}/modulos`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 400 for malformed cursoId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/cursos/not-uuid/modulos",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── POST /admin/cursos/:cursoId/modulos ───────────────────────────────────────

describe("POST /admin/cursos/:cursoId/modulos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("creates modulo and returns 201", async () => {
    mockFns.createModulo.mockResolvedValue(fakeModulo);
    const res = await app.inject({
      method: "POST",
      url: `/admin/cursos/${UUID}/modulos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Módulo 1" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().cursoId).toBe(UUID); // fakeModulo.cursoId === UUID (the curso)
  });

  it("returns 404 when curso does not exist", async () => {
    mockFns.createModulo.mockRejectedValue(new errors.CursoNotFoundError(UUID));
    const res = await app.inject({
      method: "POST",
      url: `/admin/cursos/${UUID}/modulos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "M" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for missing titulo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/cursos/${UUID}/modulos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { ordem: 1 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /admin/modulos/:moduloId ────────────────────────────────────────────

describe("PATCH /admin/modulos/:moduloId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("updates and returns 200", async () => {
    mockFns.updateModulo.mockResolvedValue({ ...fakeModulo, titulo: "Atualizado" });
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/modulos/${UUID2}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Atualizado" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().titulo).toBe("Atualizado");
  });

  it("returns 404 when not found", async () => {
    mockFns.updateModulo.mockRejectedValue(new errors.ModuloNotFoundError(UUID2));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/modulos/${UUID2}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: "/admin/modulos/not-uuid",
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /admin/modulos/:moduloId ───────────────────────────────────────────

describe("DELETE /admin/modulos/:moduloId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("deletes and returns 204", async () => {
    mockFns.deleteModulo.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/modulos/${UUID2}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 409 when modulo has aulas", async () => {
    mockFns.deleteModulo.mockRejectedValue(new errors.ModuloHasAulasError(UUID2));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/modulos/${UUID2}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 404 when not found", async () => {
    mockFns.deleteModulo.mockRejectedValue(new errors.ModuloNotFoundError(UUID2));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/modulos/${UUID2}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── GET /admin/modulos/:moduloId/aulas ────────────────────────────────────────

describe("GET /admin/modulos/:moduloId/aulas", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns aulas for modulo", async () => {
    mockFns.listAulasByModulo.mockResolvedValue([fakeAula]);
    const res = await app.inject({
      method: "GET",
      url: `/admin/modulos/${UUID2}/aulas`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 400 for malformed moduloId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/modulos/not-uuid/aulas",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── POST /admin/modulos/:moduloId/aulas ───────────────────────────────────────

describe("POST /admin/modulos/:moduloId/aulas", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("creates aula and returns 201", async () => {
    mockFns.createAula.mockResolvedValue(fakeAula);
    const res = await app.inject({
      method: "POST",
      url: `/admin/modulos/${UUID2}/aulas`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Aula 1" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().titulo).toBe("Aula 1");
  });

  it("returns 404 when modulo does not exist", async () => {
    mockFns.createAula.mockRejectedValue(new errors.ModuloNotFoundError(UUID2));
    const res = await app.inject({
      method: "POST",
      url: `/admin/modulos/${UUID2}/aulas`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "A" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for missing titulo", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/modulos/${UUID2}/aulas`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { duracaoMinutos: 30 },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /admin/aulas/:aulaId ────────────────────────────────────────────────

describe("PATCH /admin/aulas/:aulaId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("updates and returns 200", async () => {
    mockFns.updateAula.mockResolvedValue({ ...fakeAula, titulo: "Atualizada" });
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/aulas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "Atualizada" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().titulo).toBe("Atualizada");
  });

  it("returns 404 when not found", async () => {
    mockFns.updateAula.mockRejectedValue(new errors.AulaNotFoundError(UUID));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/aulas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { titulo: "X" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid tipoConteudo", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/aulas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { tipoConteudo: "invalido" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── DELETE /admin/aulas/:aulaId ───────────────────────────────────────────────

describe("DELETE /admin/aulas/:aulaId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("deletes and returns 204", async () => {
    mockFns.deleteAula.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/aulas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when not found", async () => {
    mockFns.deleteAula.mockRejectedValue(new errors.AulaNotFoundError(UUID));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/aulas/${UUID}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "DELETE",
      url: "/admin/aulas/not-uuid",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});
