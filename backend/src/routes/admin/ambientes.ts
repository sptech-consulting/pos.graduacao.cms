import type { FastifyInstance } from "fastify";
import { requireAmbienteScope } from "../../middleware/require-ambiente-scope.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { audit } from "../../services/audit.service.js";
import {
  AmbienteHasActiveMembersError,
  AmbienteNotFoundError,
  SlugConflictError,
  createAmbiente,
  deleteAmbiente,
  getAmbienteById,
  listAmbientes,
  updateAmbiente,
  updateAmbienteStatus,
} from "../../services/ambientes.service.js";

// ── Fastify JSON schemas ───────────────────────────────────────────────────────

const uuidParam = {
  type: "object",
  properties: { ambienteId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["ambienteId"],
};

const createBodySchema = {
  type: "object",
  required: ["nome", "slug"],
  additionalProperties: false,
  properties: {
    nome: { type: "string", minLength: 1, maxLength: 255 },
    slug: { type: "string", minLength: 1, maxLength: 255, pattern: "^[a-z0-9-]+$" },
    descricao: { type: "string" },
    status: { type: "string", enum: ["ativo", "inativo", "rascunho", "arquivado"] },
    corPrimaria: { type: "string", maxLength: 20 },
    corSecundaria: { type: "string", maxLength: 20 },
    corFundo: { type: "string", maxLength: 20 },
    corTexto: { type: "string", maxLength: 20 },
    corBotao: { type: "string", maxLength: 20 },
    corCard: { type: "string", maxLength: 20 },
    corBorda: { type: "string", maxLength: 20 },
    tema: { type: "string", enum: ["claro", "escuro", "personalizado"] },
  },
};

// PATCH accepts the same fields as POST, all optional
const updateBodySchema = {
  ...createBodySchema,
  required: [],
};

const statusBodySchema = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["ativo", "inativo", "rascunho", "arquivado"] },
  },
};

// ── Route handlers ────────────────────────────────────────────────────────────

const baseHandlers = [requireAuth, requireAdmin];
const tags = ["Admin — Ambientes"];
const security = [{ bearerAuth: [] }];

export async function adminAmbientesRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/ambientes
  app.get(
    "/admin/ambientes",
    {
      preHandler: [...baseHandlers, requirePermission("ambientes.visualizar")],
      schema: { tags, summary: "Lista todos os ambientes", security },
    },
    async (_req, reply) => {
      const result = await listAmbientes();
      return reply.send(result);
    },
  );

  // POST /admin/ambientes
  app.post(
    "/admin/ambientes",
    {
      preHandler: [...baseHandlers, requirePermission("ambientes.criar")],
      schema: { tags, summary: "Cria um novo ambiente", security, body: createBodySchema },
    },
    async (req, reply) => {
      const body = req.body as {
        nome: string;
        slug: string;
        descricao?: string;
        status?: "ativo" | "inativo" | "rascunho" | "arquivado";
        corPrimaria?: string;
        corSecundaria?: string;
        corFundo?: string;
        corTexto?: string;
        corBotao?: string;
        corCard?: string;
        corBorda?: string;
        tema?: "claro" | "escuro" | "personalizado";
      };

      try {
        const ambiente = await createAmbiente(body, req.user.id);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "ambientes.criar",
          entidade: "ambientes",
          entidadeId: ambiente.id,
          dadosNovos: { nome: ambiente.nome, slug: ambiente.slug },
          ip: req.ip,
        });
        return reply.status(201).send(ambiente);
      } catch (err) {
        if (err instanceof SlugConflictError)
          return reply
            .status(409)
            .send({ statusCode: 409, error: "Conflict", message: err.message });
        throw err;
      }
    },
  );

  // GET /admin/ambientes/:ambienteId
  app.get(
    "/admin/ambientes/:ambienteId",
    {
      preHandler: [
        ...baseHandlers,
        requirePermission("ambientes.visualizar"),
        requireAmbienteScope,
      ],
      schema: { tags, summary: "Busca um ambiente por ID", security, params: uuidParam },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      const ambiente = await getAmbienteById(ambienteId);
      if (!ambiente)
        return reply
          .status(404)
          .send({ statusCode: 404, error: "Not Found", message: "Ambiente não encontrado." });
      return reply.send(ambiente);
    },
  );

  // PATCH /admin/ambientes/:ambienteId
  app.patch(
    "/admin/ambientes/:ambienteId",
    {
      preHandler: [...baseHandlers, requirePermission("ambientes.editar"), requireAmbienteScope],
      schema: {
        tags,
        summary: "Atualiza dados de um ambiente",
        security,
        params: uuidParam,
        body: updateBodySchema,
      },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      const body = req.body as Record<string, unknown>;

      try {
        const ambiente = await updateAmbiente(ambienteId, body);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "ambientes.editar",
          entidade: "ambientes",
          entidadeId: ambienteId,
          dadosNovos: body,
          ip: req.ip,
        });
        return reply.send(ambiente);
      } catch (err) {
        if (err instanceof AmbienteNotFoundError)
          return reply
            .status(404)
            .send({ statusCode: 404, error: "Not Found", message: err.message });
        if (err instanceof SlugConflictError)
          return reply
            .status(409)
            .send({ statusCode: 409, error: "Conflict", message: err.message });
        throw err;
      }
    },
  );

  // PATCH /admin/ambientes/:ambienteId/status
  app.patch(
    "/admin/ambientes/:ambienteId/status",
    {
      preHandler: [...baseHandlers, requirePermission("ambientes.editar"), requireAmbienteScope],
      schema: {
        tags,
        summary: "Atualiza o status de um ambiente",
        security,
        params: uuidParam,
        body: statusBodySchema,
      },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      const { status } = req.body as { status: "ativo" | "inativo" | "rascunho" | "arquivado" };

      try {
        await updateAmbienteStatus(ambienteId, status);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "ambientes.status",
          entidade: "ambientes",
          entidadeId: ambienteId,
          dadosNovos: { status },
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AmbienteNotFoundError)
          return reply
            .status(404)
            .send({ statusCode: 404, error: "Not Found", message: err.message });
        throw err;
      }
    },
  );

  // DELETE /admin/ambientes/:ambienteId
  app.delete(
    "/admin/ambientes/:ambienteId",
    {
      preHandler: [...baseHandlers, requirePermission("ambientes.excluir"), requireAmbienteScope],
      schema: { tags, summary: "Remove um ambiente", security, params: uuidParam },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };

      try {
        await deleteAmbiente(ambienteId);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "ambientes.excluir",
          entidade: "ambientes",
          entidadeId: ambienteId,
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AmbienteNotFoundError)
          return reply
            .status(404)
            .send({ statusCode: 404, error: "Not Found", message: err.message });
        if (err instanceof AmbienteHasActiveMembersError)
          return reply
            .status(409)
            .send({ statusCode: 409, error: "Conflict", message: err.message });
        throw err;
      }
    },
  );
}
