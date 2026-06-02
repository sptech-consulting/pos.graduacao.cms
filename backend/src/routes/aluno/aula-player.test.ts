import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getAlunoAulaPlayer: vi.fn(),
  setAlunoAulaConclusao: vi.fn(),
  createAlunoAulaComentario: vi.fn(),
  saveAlunoAulaProgresso: vi.fn(),
  removeAlunoAulaComentario: vi.fn(),
  toggleAlunoAulaComentarioCurtida: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class AlunoAulaAmbienteNotFoundError extends Error {}
  class AlunoAulaAlunoNotFoundError extends Error {}
  class AlunoAulaAccessDeniedError extends Error {}
  class AlunoAulaNotFoundError extends Error {}
  class AlunoAulaComentarioNotFoundError extends Error {}
  class AlunoAulaComentarioForbiddenError extends Error {}
  class AlunoAulaComentarioRateLimitError extends Error {}

  return {
    AlunoAulaAmbienteNotFoundError,
    AlunoAulaAlunoNotFoundError,
    AlunoAulaAccessDeniedError,
    AlunoAulaNotFoundError,
    AlunoAulaComentarioNotFoundError,
    AlunoAulaComentarioForbiddenError,
    AlunoAulaComentarioRateLimitError,
  };
});

vi.mock("../../services/aluno-aula-player.service.js", () => ({ ...mockFns, ...errors }));

const mw = { auth: true, ambiente: true };

vi.mock("../../middleware/require-aluno-auth.js", () => ({
  requireAlunoAuth: vi.fn(async (req: Record<string, unknown>, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
    if (!mw.auth) {
      reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Token inválido ou ausente." });
      return;
    }

    req.user = { id: "aluno-id", role: "aluno" };
  }),
}));

vi.mock("../../middleware/require-aluno-ambiente.js", () => ({
  requireAlunoAmbiente: vi.fn(async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
    if (!mw.ambiente) {
      reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Sem acesso a este ambiente." });
    }
  }),
}));

const AULA_ID = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const COMENTARIO_ID = "b2c3d4e5-f6a7-8901-bcde-f01234567891";

async function buildApp() {
  const app = Fastify({ ajv: { customOptions: { removeAdditional: false } } });
  const { alunoAulaPlayerRoutes } = await import("./aula-player.js");
  await app.register(alunoAulaPlayerRoutes);
  await app.ready();
  return app;
}

function reset() {
  for (const fn of Object.values(mockFns)) fn.mockReset();
  mw.auth = true;
  mw.ambiente = true;
}

describe("aluno aula player routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("returns player payload for authorized aluno", async () => {
    mockFns.getAlunoAulaPlayer.mockResolvedValue({ aula: { id: AULA_ID }, comentarios: [], modulos: [], recomendados: [], branding: {}, aluno: {}, curso: {}, moduloAtual: {}, proximaAulaId: null, proximaAulaTitulo: null });

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/aulas/${AULA_ID}/player` });

    expect(res.statusCode).toBe(200);
    expect(mockFns.getAlunoAulaPlayer).toHaveBeenCalledWith("ia", AULA_ID, "aluno-id");
  });

  it("returns 401 when auth blocks player route", async () => {
    mw.auth = false;

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/aulas/${AULA_ID}/player` });

    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for BOLA via ambiente middleware on player route", async () => {
    mw.ambiente = false;

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/outra/aulas/${AULA_ID}/player` });

    expect(res.statusCode).toBe(403);
  });

  it("returns 404 when aula service reports not found", async () => {
    mockFns.getAlunoAulaPlayer.mockRejectedValue(new errors.AlunoAulaNotFoundError("aula"));

    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/ia/aulas/${AULA_ID}/player` });

    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for malformed aula id in player route", async () => {
    const res = await app.inject({ method: "GET", url: "/aluno/ambientes/ia/aulas/not-uuid/player" });

    expect(res.statusCode).toBe(400);
  });

  it("marks aula conclusao", async () => {
    mockFns.setAlunoAulaConclusao.mockResolvedValue({ ok: true });

    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/conclusao`,
      payload: { concluida: true },
    });

    expect(res.statusCode).toBe(200);
    expect(mockFns.setAlunoAulaConclusao).toHaveBeenCalledWith("ia", AULA_ID, "aluno-id", true);
  });

  it("returns 400 for extra properties on conclusao payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/conclusao`,
      payload: { concluida: true, extra: 1 },
    });

    expect(res.statusCode).toBe(400);
  });

  it("saves video progress", async () => {
    mockFns.saveAlunoAulaProgresso.mockResolvedValue({ ok: true });

    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/progresso`,
      payload: { segundos: 120, concluida: false },
    });

    expect(res.statusCode).toBe(200);
    expect(mockFns.saveAlunoAulaProgresso).toHaveBeenCalledWith("ia", AULA_ID, "aluno-id", 120, false);
  });

  it("returns 400 for invalid segundos payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/progresso`,
      payload: { segundos: -1 },
    });

    expect(res.statusCode).toBe(400);
  });

  it("creates comentario", async () => {
    mockFns.createAlunoAulaComentario.mockResolvedValue({ id: COMENTARIO_ID });

    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/comentarios`,
      payload: { conteudo: "Teste", parentId: null },
    });

    expect(res.statusCode).toBe(201);
    expect(mockFns.createAlunoAulaComentario).toHaveBeenCalledWith("ia", AULA_ID, "aluno-id", "Teste", null);
  });

  it("returns 429 when comment rate limit is hit", async () => {
    mockFns.createAlunoAulaComentario.mockRejectedValue(new errors.AlunoAulaComentarioRateLimitError("limite"));

    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/comentarios`,
      payload: { conteudo: "Teste" },
    });

    expect(res.statusCode).toBe(429);
  });

  it("returns 400 for invalid comentario payload", async () => {
    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/comentarios`,
      payload: { conteudo: "" },
    });

    expect(res.statusCode).toBe(400);
  });

  it("removes own comentario", async () => {
    mockFns.removeAlunoAulaComentario.mockResolvedValue({ ok: true });

    const res = await app.inject({
      method: "DELETE",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/comentarios/${COMENTARIO_ID}`,
    });

    expect(res.statusCode).toBe(200);
    expect(mockFns.removeAlunoAulaComentario).toHaveBeenCalledWith("ia", AULA_ID, COMENTARIO_ID, "aluno-id");
  });

  it("returns 403 when removing comentario without ownership", async () => {
    mockFns.removeAlunoAulaComentario.mockRejectedValue(new errors.AlunoAulaComentarioForbiddenError("forbidden"));

    const res = await app.inject({
      method: "DELETE",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/comentarios/${COMENTARIO_ID}`,
    });

    expect(res.statusCode).toBe(403);
  });

  it("toggles curtida", async () => {
    mockFns.toggleAlunoAulaComentarioCurtida.mockResolvedValue({ liked: true });

    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/comentarios/${COMENTARIO_ID}/curtida`,
    });

    expect(res.statusCode).toBe(200);
    expect(mockFns.toggleAlunoAulaComentarioCurtida).toHaveBeenCalledWith("ia", AULA_ID, COMENTARIO_ID, "aluno-id");
  });

  it("returns 404 when curtindo comentario inexistente", async () => {
    mockFns.toggleAlunoAulaComentarioCurtida.mockRejectedValue(new errors.AlunoAulaComentarioNotFoundError("missing"));

    const res = await app.inject({
      method: "POST",
      url: `/aluno/ambientes/ia/aulas/${AULA_ID}/comentarios/${COMENTARIO_ID}/curtida`,
    });

    expect(res.statusCode).toBe(404);
  });
});
