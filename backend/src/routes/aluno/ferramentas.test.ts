import Fastify from "fastify";
import rateLimit from "@fastify/rate-limit";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getAlunoFerramentaDetalhe: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class AlunoFerramentaAmbienteNotFoundError extends Error {
    constructor(slug: string) {
      super(`Ambiente não encontrado ou inativo: ${slug}`);
      this.name = "AlunoFerramentaAmbienteNotFoundError";
    }
  }

  class AlunoFerramentaAlunoNotFoundError extends Error {
    constructor(alunoId: string) {
      super(`Aluno não cadastrado ou inativo: ${alunoId}`);
      this.name = "AlunoFerramentaAlunoNotFoundError";
    }
  }

  class AlunoFerramentaAccessDeniedError extends Error {
    constructor(alunoId: string, slug: string) {
      super(`Aluno ${alunoId} sem acesso a este ambiente: ${slug}`);
      this.name = "AlunoFerramentaAccessDeniedError";
    }
  }

  class AlunoFerramentaNotFoundError extends Error {
    constructor(slug: string, ferramentaId: string) {
      super(`Ferramenta não encontrada para slug=${slug} e ferramentaId=${ferramentaId}. Esperado: ferramenta ativa e vinculada ao ambiente.`);
      this.name = "AlunoFerramentaNotFoundError";
    }
  }

  return {
    AlunoFerramentaAmbienteNotFoundError,
    AlunoFerramentaAlunoNotFoundError,
    AlunoFerramentaAccessDeniedError,
    AlunoFerramentaNotFoundError,
  };
});

vi.mock("../../services/aluno-ferramentas.service.js", () => ({ ...mockFns, ...errors }));

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

const UUID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

async function buildApp() {
  const app = Fastify();
  await app.register(rateLimit, {
    max: 1,
    timeWindow: "1 minute",
    errorResponseBuilder: () => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: "Rate limit exceeded. Try again later.",
    }),
  });
  const { alunoFerramentasRoutes } = await import("./ferramentas.js");
  await app.register(alunoFerramentasRoutes);
  await app.ready();
  return app;
}

function reset() {
  mockFns.getAlunoFerramentaDetalhe.mockReset();
  mw.auth = true;
  mw.ambiente = true;
}

describe("GET /aluno/ambientes/:slug/ferramentas/:ferramentaId", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns ferramenta payload for authorized aluno", async () => {
    mockFns.getAlunoFerramentaDetalhe.mockResolvedValue({
      id: UUID,
      nome: "Ferramenta X",
      descricao: "Descrição",
      subtitulo: null,
      descricaoLonga: null,
      url: null,
      iconeUrl: null,
      imagemCapaUrl: null,
      categoria: null,
      tipoAbertura: null,
      fraseDestaque: null,
      casosUso: [],
      tags: [],
      blocos: [],
      funcionalidades: [],
      casosTeste: [],
      ambienteSlug: "ia",
      ambienteNome: "IA",
    });

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/ferramentas/${UUID}` });

    expect(res.statusCode).toBe(200);
    expect(res.json().id).toBe(UUID);
  });

  it("returns 401 when auth middleware blocks", async () => {
    mw.auth = false;

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/ferramentas/${UUID}` });

    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for BOLA via ambiente middleware", async () => {
    mw.ambiente = false;

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/ferramentas/${UUID}` });

    expect(res.statusCode).toBe(403);
  });

  it("returns 400 for malformed UUID", async () => {
    const res = await app.inject({ method: "GET", url: "/aluno/ambientes/ia/ferramentas/not-uuid" });

    expect(res.statusCode).toBe(400);
  });

  it("returns 404 when ferramenta is not found", async () => {
    mockFns.getAlunoFerramentaDetalhe.mockRejectedValue(new errors.AlunoFerramentaNotFoundError("ia", UUID));

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/ferramentas/${UUID}` });

    expect(res.statusCode).toBe(404);
  });

  it("returns 404 when ambiente is not found", async () => {
    mockFns.getAlunoFerramentaDetalhe.mockRejectedValue(new errors.AlunoFerramentaAmbienteNotFoundError("ia"));

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/ferramentas/${UUID}` });

    expect(res.statusCode).toBe(404);
  });

  it("returns 403 when aluno is inactive", async () => {
    mockFns.getAlunoFerramentaDetalhe.mockRejectedValue(new errors.AlunoFerramentaAlunoNotFoundError("aluno-id"));

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/ferramentas/${UUID}` });

    expect(res.statusCode).toBe(403);
  });

  it("returns 429 when rate limit is exceeded", async () => {
    mockFns.getAlunoFerramentaDetalhe.mockResolvedValue({
      id: UUID,
      nome: "Ferramenta X",
      descricao: null,
      subtitulo: null,
      descricaoLonga: null,
      url: null,
      iconeUrl: null,
      imagemCapaUrl: null,
      categoria: null,
      tipoAbertura: null,
      fraseDestaque: null,
      casosUso: [],
      tags: [],
      blocos: [],
      funcionalidades: [],
      casosTeste: [],
      ambienteSlug: "ia",
      ambienteNome: "IA",
    });

    const first = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/ferramentas/${UUID}` });
    const second = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/ferramentas/${UUID}` });

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(429);
  });
});
