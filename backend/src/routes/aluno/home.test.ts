import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getAlunoAmbienteHome: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class AlunoHomeAmbienteNotFoundError extends Error {
    constructor(slug: string) {
      super(`Ambiente não encontrado ou inativo: ${slug}`);
      this.name = "AlunoHomeAmbienteNotFoundError";
    }
  }

  class AlunoHomeAlunoNotFoundError extends Error {
    constructor(alunoId: string) {
      super(`Aluno não cadastrado ou inativo: ${alunoId}`);
      this.name = "AlunoHomeAlunoNotFoundError";
    }
  }

  class AlunoHomeAccessDeniedError extends Error {
    constructor(alunoId: string, slug: string) {
      super(`Aluno ${alunoId} sem acesso a este ambiente: ${slug}`);
      this.name = "AlunoHomeAccessDeniedError";
    }
  }

  return { AlunoHomeAmbienteNotFoundError, AlunoHomeAlunoNotFoundError, AlunoHomeAccessDeniedError };
});

vi.mock("../../services/aluno-home.service.js", () => ({ ...mockFns, ...errors }));

const mw = { auth: true, ambiente: true };

vi.mock("../../middleware/require-aluno-auth.js", () => ({
  requireAlunoAuth: vi.fn(
    async (
      req: Record<string, unknown>,
      reply: { status: (n: number) => { send: (b: unknown) => void } },
    ) => {
      if (!mw.auth) {
        reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Token inválido ou ausente." });
        return;
      }

      req.user = { id: "aluno-id", role: "aluno" };
    },
  ),
}));

vi.mock("../../middleware/require-aluno-ambiente.js", () => ({
  requireAlunoAmbiente: vi.fn(
    async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
      if (!mw.ambiente) {
        reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Sem acesso a este ambiente." });
      }
    },
  ),
}));

async function buildApp() {
  const app = Fastify();
  const { alunoHomeRoutes } = await import("./home.js");
  await app.register(alunoHomeRoutes);
  await app.ready();
  return app;
}

function reset() {
  mockFns.getAlunoAmbienteHome.mockReset();
  mw.auth = true;
  mw.ambiente = true;
}

describe("GET /aluno/ambientes/:slug/home", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns home payload for authorized aluno", async () => {
    mockFns.getAlunoAmbienteHome.mockResolvedValue({ branding: { nome: "IA" }, aluno: { id: "aluno-id" }, ferramentas: [], novidades: [], aulas: [], cursos: [] });

    const res = await app.inject({ method: "GET", url: "/aluno/ambientes/ia/home" });

    expect(res.statusCode).toBe(200);
    expect(res.json().branding.nome).toBe("IA");
  });

  it("returns 401 when auth middleware blocks", async () => {
    mw.auth = false;

    const res = await app.inject({ method: "GET", url: "/aluno/ambientes/ia/home" });

    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for BOLA via ambiente middleware", async () => {
    mw.ambiente = false;

    const res = await app.inject({ method: "GET", url: "/aluno/ambientes/ia/home" });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when ambiente is not found", async () => {
    mockFns.getAlunoAmbienteHome.mockRejectedValue(new errors.AlunoHomeAmbienteNotFoundError("ia"));

    const res = await app.inject({ method: "GET", url: "/aluno/ambientes/ia/home" });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when aluno is inactive", async () => {
    mockFns.getAlunoAmbienteHome.mockRejectedValue(new errors.AlunoHomeAlunoNotFoundError("aluno-id"));

    const res = await app.inject({ method: "GET", url: "/aluno/ambientes/ia/home" });

    expect(res.statusCode).toBe(403);
  });
});
