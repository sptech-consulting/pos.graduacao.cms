import fastifyJwt from "@fastify/jwt";
import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock — configured per test ────────────────────────────────────────────

const mockAlunoRow: { value: { id: string; status: string } | undefined } = {
  value: undefined,
};

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (mockAlunoRow.value ? [mockAlunoRow.value] : []),
        }),
      }),
    }),
  },
}));

// ── Test app builder ─────────────────────────────────────────────────────────

async function buildApp() {
  const app = Fastify();
  await app.register(fastifyJwt, { secret: "test-secret-min-32-chars-for-vitest" });
  const { requireAlunoAuth } = await import("./require-aluno-auth.js");
  app.get("/protected", { preHandler: requireAlunoAuth }, (_req, reply) =>
    reply.send({ ok: true }),
  );
  await app.ready();
  return app;
}

function token(app: Awaited<ReturnType<typeof buildApp>>, payload: object) {
  return (app as unknown as { jwt: { sign: (p: object) => string } }).jwt.sign(payload);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("requireAlunoAuth", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    app = await buildApp();
    mockAlunoRow.value = undefined;
  });

  it("passes for active aluno", async () => {
    mockAlunoRow.value = { id: "aluno-1", status: "ativo" };
    const res = await app.inject({
      method: "GET", url: "/protected",
      headers: { authorization: `Bearer ${token(app, { id: "aluno-1", role: "aluno" })}` },
    });
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 with no token", async () => {
    const res = await app.inject({ method: "GET", url: "/protected" });
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 with invalid token", async () => {
    const res = await app.inject({
      method: "GET", url: "/protected",
      headers: { authorization: "Bearer invalid.jwt.token" },
    });
    expect(res.statusCode).toBe(401);
  });

  it("returns 403 for inactive aluno", async () => {
    mockAlunoRow.value = { id: "aluno-1", status: "inativo" };
    const res = await app.inject({
      method: "GET", url: "/protected",
      headers: { authorization: `Bearer ${token(app, { id: "aluno-1", role: "aluno" })}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 for blocked aluno", async () => {
    mockAlunoRow.value = { id: "aluno-1", status: "bloqueado" };
    const res = await app.inject({
      method: "GET", url: "/protected",
      headers: { authorization: `Bearer ${token(app, { id: "aluno-1", role: "aluno" })}` },
    });
    expect(res.statusCode).toBe(403);
  });

  it("returns 403 when JWT role is admin (wrong role for aluno route)", async () => {
    const res = await app.inject({
      method: "GET", url: "/protected",
      headers: { authorization: `Bearer ${token(app, { id: "admin-1", role: "admin" })}` },
    });
    expect(res.statusCode).toBe(403);
  });
});
