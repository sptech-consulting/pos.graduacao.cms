import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/require-admin.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import {
  AdminComentarioNotFoundError,
  getAdminMetricas,
  listAdminComentarios,
  listAdminLogs,
  moderarComentarioAdmin,
} from "../../services/admin-comentarios.service.js";

const base = [requireAuth, requireAdmin];

export async function adminComentariosRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/admin/comentarios",
    {
      preHandler: [...base, requirePermission("usuarios.visualizar")],
      schema: {
        tags: ["Admin — Comentários"],
        summary: "Lista comentários para moderação",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            status: { type: "string" },
            ambienteId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
            busca: { type: "string", maxLength: 200 },
          },
        },
      },
    },
    async (req, reply) => {
      const query = req.query as { status?: string; ambienteId?: string; busca?: string };
      return reply.send(await listAdminComentarios(query));
    },
  );

  app.patch(
    "/admin/comentarios/:comentarioId/status",
    {
      preHandler: [...base, requirePermission("usuarios.editar")],
      schema: {
        tags: ["Admin — Comentários"],
        summary: "Modera comentário de aula",
        security: [{ bearerAuth: [] }],
        params: {
          type: "object",
          required: ["comentarioId"],
          properties: { comentarioId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
          additionalProperties: false,
        },
        body: {
          type: "object",
          required: ["status"],
          properties: { status: { type: "string", enum: ["ativo", "oculto", "removido"] } },
          additionalProperties: false,
        },
      },
    },
    async (req, reply) => {
      const { comentarioId } = req.params as { comentarioId: string };
      const { status } = req.body as { status: "ativo" | "oculto" | "removido" };
      try {
        return reply.send(await moderarComentarioAdmin({ comentarioId, status, usuarioAdminId: req.user.id, ip: req.ip }));
      } catch (error) {
        if (error instanceof AdminComentarioNotFoundError) {
          return reply.status(404).send({ statusCode: 404, error: "Not Found", message: error.message });
        }
        throw error;
      }
    },
  );

  app.get(
    "/admin/logs",
    {
      preHandler: [...base, requirePermission("usuarios.visualizar")],
      schema: {
        tags: ["Admin — Logs"],
        summary: "Lista logs de auditoria",
        security: [{ bearerAuth: [] }],
        querystring: {
          type: "object",
          additionalProperties: false,
          properties: {
            acao: { type: "string", maxLength: 200 },
            ambienteId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
            limit: { type: "integer", minimum: 1, maximum: 500 },
          },
        },
      },
    },
    async (req, reply) => {
      return reply.send(await listAdminLogs(req.query as { acao?: string; ambienteId?: string; limit?: number }));
    },
  );

  app.get(
    "/admin/metricas",
    {
      preHandler: [...base, requirePermission("usuarios.visualizar")],
      schema: {
        tags: ["Admin — Métricas"],
        summary: "Retorna métricas administrativas consolidadas",
        security: [{ bearerAuth: [] }],
      },
    },
    async (_req, reply) => {
      return reply.send(await getAdminMetricas());
    },
  );
}
