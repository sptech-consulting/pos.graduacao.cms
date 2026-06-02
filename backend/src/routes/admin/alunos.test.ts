import fastifyCookie from "@fastify/cookie";
import fastifyJwt from "@fastify/jwt";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── vi.hoisted ────────────────────────────────────────────────────────────────

const mockFns = vi.hoisted(() => ({
  listAlunosDoAmbiente: vi.fn(),
  createAluno: vi.fn(),
  getAlunoDoAmbiente: vi.fn(),
  updateAluno: vi.fn(),
  updateAlunoStatus: vi.fn(),
  desvincularAluno: vi.fn(),
  importarAlunos: vi.fn(),
  listImportacoes: vi.fn(),
  getImportacaoById: vi.fn(),
  listImportacaoErros: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class AlunoNotFoundError extends Error {
    constructor(id: string) {
      super(`Aluno não encontrado: ${id}`);
      this.name = "AlunoNotFoundError";
    }
  }
  class AlunoNaoVinculadoError extends Error {
    constructor(a: string, b: string) {
      super(`Aluno ${b} não vinculado a ${a}`);
      this.name = "AlunoNaoVinculadoError";
    }
  }
  class AlunoJaVinculadoError extends Error {
    constructor(a: string, b: string) {
      super(`Aluno ${b} já vinculado a ${a}`);
      this.name = "AlunoJaVinculadoError";
    }
  }
  class EmailDuplicadoError extends Error {
    constructor(email: string) {
      super(`Email já cadastrado: ${email}`);
      this.name = "EmailDuplicadoError";
    }
  }
  class ImportacaoNotFoundError extends Error {
    constructor(id: string) {
      super(`Importação não encontrada: ${id}`);
      this.name = "ImportacaoNotFoundError";
    }
  }
  return {
    AlunoNotFoundError,
    AlunoNaoVinculadoError,
    AlunoJaVinculadoError,
    EmailDuplicadoError,
    ImportacaoNotFoundError,
  };
});

vi.mock("../../services/alunos.service.js", () => ({ ...mockFns, ...errors }));

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
  const { adminAlunosRoutes } = await import("./alunos.js");
  await app.register(adminAlunosRoutes);
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
const ALUNO = "b2c3d4e5-f6a7-8901-bcde-f01234567891";
const IMPORT = "c3d4e5f6-a7b8-9012-cdef-012345678912";

const fakeAluno = {
  id: ALUNO,
  nomeCompleto: "Ana Silva",
  emailAcesso: "ana@sptech.school",
  status: "ativo",
};
const fakeImportacao = {
  id: IMPORT,
  ambienteId: AMB,
  status: "concluida",
  totalLinhas: 1,
  totalImportados: 1,
  totalErros: 0,
};

function reset() {
  Object.values(mockFns).forEach((fn) => fn.mockReset());
  Object.assign(mw, { auth: true, admin: true, permission: true, scope: true });
}

// ── GET /admin/ambientes/:ambienteId/alunos ───────────────────────────────────

describe("GET /admin/ambientes/:ambienteId/alunos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns list of alunos", async () => {
    mockFns.listAlunosDoAmbiente.mockResolvedValue([fakeAluno]);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/alunos`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 401 with no token", async () => {
    mw.auth = false;
    const res = await app.inject({ method: "GET", url: `/admin/ambientes/${AMB}/alunos` });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when scoped admin accesses another ambiente (BOLA)", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/alunos`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 400 for malformed ambienteId", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/ambientes/not-uuid/alunos",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── POST /admin/ambientes/:ambienteId/alunos ──────────────────────────────────

describe("POST /admin/ambientes/:ambienteId/alunos", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("creates aluno and returns 201", async () => {
    mockFns.createAluno.mockResolvedValue(fakeAluno);
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/alunos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nomeCompleto: "Ana Silva", emailAcesso: "ana@sptech.school" },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().emailAcesso).toBe("ana@sptech.school");
  });

  it("returns 409 when aluno already linked to ambiente", async () => {
    mockFns.createAluno.mockRejectedValue(new errors.AlunoJaVinculadoError(AMB, ALUNO));
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/alunos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nomeCompleto: "Ana", emailAcesso: "ana@sptech.school" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 400 for missing nomeCompleto", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/alunos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { emailAcesso: "ana@sptech.school" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for missing emailAcesso", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/alunos`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nomeCompleto: "Ana" },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /admin/ambientes/:ambienteId/alunos/:alunoId ─────────────────────────

describe("GET /admin/ambientes/:ambienteId/alunos/:alunoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns aluno by id", async () => {
    mockFns.getAlunoDoAmbiente.mockResolvedValue(fakeAluno);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(ALUNO);
  });

  it("returns 404 when aluno not found", async () => {
    mockFns.getAlunoDoAmbiente.mockRejectedValue(new errors.AlunoNotFoundError(ALUNO));
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when aluno not linked to ambiente (IDOR)", async () => {
    mockFns.getAlunoDoAmbiente.mockRejectedValue(new errors.AlunoNaoVinculadoError(AMB, ALUNO));
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed alunoId", async () => {
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/alunos/not-uuid`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── PATCH /admin/ambientes/:ambienteId/alunos/:alunoId ───────────────────────

describe("PATCH /admin/ambientes/:ambienteId/alunos/:alunoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("updates aluno and returns 200", async () => {
    mockFns.updateAluno.mockResolvedValue({ ...fakeAluno, nomeCompleto: "Ana Santos" });
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nomeCompleto: "Ana Santos" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().nomeCompleto).toBe("Ana Santos");
  });

  it("returns 404 when aluno not linked (IDOR)", async () => {
    mockFns.updateAluno.mockRejectedValue(new errors.AlunoNaoVinculadoError(AMB, ALUNO));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nomeCompleto: "X" },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 409 when email is already taken", async () => {
    mockFns.updateAluno.mockRejectedValue(new errors.EmailDuplicadoError("outro@sptech.school"));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { emailAcesso: "outro@sptech.school" },
    });
    expect(res.statusCode).toBe(409);
  });

  it("returns 403 for BOLA via scope middleware", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { nomeCompleto: "X" },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── PATCH /admin/ambientes/:ambienteId/alunos/:alunoId/status ────────────────

describe("PATCH /admin/ambientes/:ambienteId/alunos/:alunoId/status", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("updates status and returns 204", async () => {
    mockFns.updateAlunoStatus.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}/status`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { status: "inativo" },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 400 for invalid status value", async () => {
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}/status`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { status: "arquivado" },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when aluno not linked (IDOR)", async () => {
    mockFns.updateAlunoStatus.mockRejectedValue(new errors.AlunoNaoVinculadoError(AMB, ALUNO));
    const res = await app.inject({
      method: "PATCH",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}/status`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { status: "inativo" },
    });
    expect(res.statusCode).toBe(404);
  });
});

// ── DELETE /admin/ambientes/:ambienteId/alunos/:alunoId ──────────────────────

describe("DELETE /admin/ambientes/:ambienteId/alunos/:alunoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("desvincula and returns 204", async () => {
    mockFns.desvincularAluno.mockResolvedValue(undefined);
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(204);
  });

  it("returns 404 when aluno not linked (IDOR)", async () => {
    mockFns.desvincularAluno.mockRejectedValue(new errors.AlunoNaoVinculadoError(AMB, ALUNO));
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 403 for BOLA via scope middleware", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "DELETE",
      url: `/admin/ambientes/${AMB}/alunos/${ALUNO}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── POST /admin/ambientes/:ambienteId/alunos/importar ─────────────────────────

describe("POST /admin/ambientes/:ambienteId/alunos/importar", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns 201 with importacao result", async () => {
    mockFns.importarAlunos.mockResolvedValue(fakeImportacao);
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/alunos/importar`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { rows: [{ nomeCompleto: "Ana Silva", emailAcesso: "ana@sptech.school" }] },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().id).toBe(IMPORT);
  });

  it("returns 400 for empty rows array", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/alunos/importar`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { rows: [] },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for rows exceeding 500 limit", async () => {
    const rows = Array.from({ length: 501 }, (_, i) => ({
      nomeCompleto: `Aluno ${i}`,
      emailAcesso: `aluno${i}@test.com`,
    }));
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/alunos/importar`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: { rows },
    });
    expect(res.statusCode).toBe(400);
  });

  it("returns 400 for missing rows field", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/admin/ambientes/${AMB}/alunos/importar`,
      headers: { authorization: `Bearer ${tok(app)}` },
      payload: {},
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /admin/ambientes/:ambienteId/importacoes ──────────────────────────────

describe("GET /admin/ambientes/:ambienteId/importacoes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns list of importacoes", async () => {
    mockFns.listImportacoes.mockResolvedValue([fakeImportacao]);
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/importacoes`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 403 for BOLA via scope middleware", async () => {
    mw.scope = false;
    const res = await app.inject({
      method: "GET",
      url: `/admin/ambientes/${AMB}/importacoes`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(403);
  });
});

// ── GET /admin/importacoes/:importacaoId ──────────────────────────────────────

describe("GET /admin/importacoes/:importacaoId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns importacao by id", async () => {
    mockFns.getImportacaoById.mockResolvedValue(fakeImportacao);
    const res = await app.inject({
      method: "GET",
      url: `/admin/importacoes/${IMPORT}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 when not found", async () => {
    mockFns.getImportacaoById.mockResolvedValue(null);
    const res = await app.inject({
      method: "GET",
      url: `/admin/importacoes/${IMPORT}`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({
      method: "GET",
      url: "/admin/importacoes/not-uuid",
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(400);
  });
});

// ── GET /admin/importacoes/:importacaoId/erros ────────────────────────────────

describe("GET /admin/importacoes/:importacaoId/erros", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;
  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns errors for importacao", async () => {
    mockFns.listImportacaoErros.mockResolvedValue([{ id: "err-1", erro: "Email inválido" }]);
    const res = await app.inject({
      method: "GET",
      url: `/admin/importacoes/${IMPORT}/erros`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toHaveLength(1);
  });

  it("returns 404 when importacao not found", async () => {
    mockFns.listImportacaoErros.mockRejectedValue(new errors.ImportacaoNotFoundError(IMPORT));
    const res = await app.inject({
      method: "GET",
      url: `/admin/importacoes/${IMPORT}/erros`,
      headers: { authorization: `Bearer ${tok(app)}` },
    });
    expect(res.statusCode).toBe(404);
  });
});
