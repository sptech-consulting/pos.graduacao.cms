import Fastify from "fastify";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockFns = vi.hoisted(() => ({
  listAdminComentarios: vi.fn(),
  moderarComentarioAdmin: vi.fn(),
  listAdminLogs: vi.fn(),
  getAdminMetricas: vi.fn(),
}));

const errors = vi.hoisted(() => {
  class AdminComentarioNotFoundError extends Error {
    constructor(comentarioId: string) {
      super(`Comentário não encontrado: ${comentarioId}`);
      this.name = "AdminComentarioNotFoundError";
    }
  }
  return { AdminComentarioNotFoundError };
});

vi.mock("../../services/admin-comentarios.service.js", () => ({ ...mockFns, ...errors }));

const mw = { auth: true, admin: true, permission: true };

vi.mock("../../middleware/require-auth.js", () => ({
  requireAuth: vi.fn(async (req: Record<string, unknown>, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
    if (!mw.auth) {
      reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Token inválido ou ausente." });
      return;
    }
    req.user = { id: "admin-id", role: "admin" };
  }),
}));

vi.mock("../../middleware/require-admin.js", () => ({
  requireAdmin: vi.fn(async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
    if (!mw.admin) {
      reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Acesso negado." });
    }
  }),
}));

vi.mock("../../middleware/require-permission.js", () => ({
  requirePermission: vi.fn(() => async (_req: unknown, reply: { status: (n: number) => { send: (b: unknown) => void } }) => {
    if (!mw.permission) {
      reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Permissão insuficiente." });
    }
  }),
}));

async function buildApp() {
  const app = Fastify();
  const { adminComentariosRoutes } = await import("./comentarios.js");
  await app.register(adminComentariosRoutes);
  await app.ready();
  return app;
}

function reset() {
  mw.auth = true;
  mw.admin = true;
  mw.permission = true;
  Object.values(mockFns).forEach((fn) => fn.mockReset());
}

describe("admin comentarios routes", () => {
  let app: Awaited<ReturnType<typeof buildApp>>;

  beforeEach(async () => {
    reset();
    app = await buildApp();
  });

  it("lists comentarios", async () => {
    mockFns.listAdminComentarios.mockResolvedValue([]);
    const res = await app.inject({ method: "GET", url: "/admin/comentarios?status=ativo" });
    expect(res.statusCode).toBe(200);
  });

  it("returns 401 without auth", async () => {
    mw.auth = false;
    const res = await app.inject({ method: "GET", url: "/admin/comentarios" });
    expect(res.statusCode).toBe(401);
  });

  it("moderates comentario", async () => {
    mockFns.moderarComentarioAdmin.mockResolvedValue({ ok: true });
    const res = await app.inject({ method: "PATCH", url: "/admin/comentarios/a1b2c3d4-e5f6-7890-abcd-ef1234567890/status", payload: { status: "oculto" } });
    expect(res.statusCode).toBe(200);
  });

  it("returns 404 when comentario is missing", async () => {
    mockFns.moderarComentarioAdmin.mockRejectedValue(new errors.AdminComentarioNotFoundError("x"));
    const res = await app.inject({ method: "PATCH", url: "/admin/comentarios/a1b2c3d4-e5f6-7890-abcd-ef1234567890/status", payload: { status: "oculto" } });
    expect(res.statusCode).toBe(404);
  });

  it("returns 400 for invalid moderation payload", async () => {
    const res = await app.inject({ method: "PATCH", url: "/admin/comentarios/a1b2c3d4-e5f6-7890-abcd-ef1234567890/status", payload: { status: "ruim" } });
    expect(res.statusCode).toBe(400);
  });

  it("lists logs", async () => {
    mockFns.listAdminLogs.mockResolvedValue([]);
    const res = await app.inject({ method: "GET", url: "/admin/logs?limit=10" });
    expect(res.statusCode).toBe(200);
  });

  it("returns metrics", async () => {
    mockFns.getAdminMetricas.mockResolvedValue({ totais: {}, aulasMaisAssistidas: [], comentariosPorDia: [], ambientesMaisEngajados: [] });
    const res = await app.inject({ method: "GET", url: "/admin/metricas" });
    expect(res.statusCode).toBe(200);
  });
});
