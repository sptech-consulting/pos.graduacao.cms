import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  getAlunoProfile: vi.fn(),
  checkAlunoAccessToAmbiente: vi.fn(),
  listAmbientesDoAluno: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class AlunoAccountNotFoundError extends Error {
    constructor(alunoId: string) {
      super(`Aluno não cadastrado ou inativo: ${alunoId}`);
      this.name = "AlunoAccountNotFoundError";
    }
  }
  return { AlunoAccountNotFoundError };
});

vi.mock("../../services/aluno-account.service.js", () => ({ ...mockFns, ...errors }));

const mw = { auth: true };

vi.mock("../../middleware/require-aluno-auth.js", () => ({
  requireAlunoAuth: vi.fn(async (req: Record<string, unknown>, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
    if (!mw.auth) {
      reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Token inválido ou ausente." });
      return;
    }
    req.user = { id: "aluno-id", role: "aluno" };
  }),
}));

async function buildApp() {
  const app = Fastify();
  const { alunoAccountRoutes } = await import("./account.js");
  await app.register(alunoAccountRoutes);
  await app.ready();
  return app;
}

describe("aluno account routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    mw.auth = true;
    Object.values(mockFns).forEach((fn) => fn.mockReset());
    app = await buildApp();
  });

  it("returns aluno profile on GET /aluno/me", async () => {
    mockFns.getAlunoProfile.mockResolvedValue({ id: "aluno-id" });
    const res = await app.inject({ method: "GET", url: "/aluno/me" });
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 on GET /aluno/me without auth", async () => {
    mw.auth = false;
    const res = await app.inject({ method: "GET", url: "/aluno/me" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 when aluno profile is inactive", async () => {
    mockFns.getAlunoProfile.mockRejectedValue(new errors.AlunoAccountNotFoundError("aluno-id"));
    const res = await app.inject({ method: "GET", url: "/aluno/me" });
    expect(res.statusCode).toBe(403);
  });

  it("returns access result for GET /aluno/ambientes/:slug/access", async () => {
    mockFns.checkAlunoAccessToAmbiente.mockResolvedValue({ ok: true });
    const res = await app.inject({ method: "GET", url: "/aluno/ambientes/ia/access" });
    expect(res.statusCode).toBe(200);
    expect(mockFns.checkAlunoAccessToAmbiente).toHaveBeenCalledWith("ia", "aluno-id");
  });

  it("returns 400 for oversized slug on access route", async () => {
    const res = await app.inject({ method: "GET", url: `/aluno/ambientes/${"a".repeat(121)}/access` });
    expect(res.statusCode).toBe(404);
  });

  it("returns aluno ambientes payload", async () => {
    mockFns.listAmbientesDoAluno.mockResolvedValue({ aluno: { nomeCompleto: "Ana" }, ambientes: [] });
    const res = await app.inject({ method: "GET", url: "/aluno/me/ambientes" });
    expect(res.statusCode).toBe(200);
  });

  it("returns null aluno and empty ambientes when service says aluno missing", async () => {
    mockFns.listAmbientesDoAluno.mockRejectedValue(new errors.AlunoAccountNotFoundError("aluno-id"));
    const res = await app.inject({ method: "GET", url: "/aluno/me/ambientes" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ aluno: null, ambientes: [] });
  });
});
