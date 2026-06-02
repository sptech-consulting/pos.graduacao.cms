import type { FastifyInstance } from "fastify";
import { requireAmbienteScope } from "../../middleware/require-ambiente-scope.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { audit } from "../../services/audit.service.js";
import {
  TrabalhoNotFoundError,
  createTrabalho,
  deleteTrabalho,
  getTrabalhoById,
  getTrabalhoPublico,
  listTrabalhos,
  listTrabalhosPublicos,
  updateTrabalho,
} from "../../services/trabalhos.service.js";

// ── Param schemas ─────────────────────────────────────────────────────────────

const pAmbiente = {
  type: "object",
  properties: { ambienteId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["ambienteId"],
};

const pAmbienteTrabalho = {
  type: "object",
  properties: {
    ambienteId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    trabalhoId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
  },
  required: ["ambienteId", "trabalhoId"],
};

const pTrabalho = {
  type: "object",
  properties: { trabalhoId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["trabalhoId"],
};

const qAmbiente = {
  type: "object",
  properties: { ambienteId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["ambienteId"],
};

// ── Body schemas ──────────────────────────────────────────────────────────────

const trabalhoProps = {
  titulo: { type: "string", minLength: 1, maxLength: 500 },
  autorNome: { type: "string", minLength: 1, maxLength: 500 },
  subtitulo: { type: "string", maxLength: 500 },
  resumo: { type: "string", maxLength: 2000 },
  conteudo: { type: "string" },
  turma: { type: "string", maxLength: 200 },
  imagemCapaUrl: { type: "string", maxLength: 2000 },
  linkExterno: { type: "string", maxLength: 2000 },
  tags: { type: "array", items: { type: "string", maxLength: 100 }, maxItems: 20 },
  status: { type: "string", enum: ["rascunho", "publicada", "arquivada"] },
  destaque: { type: "boolean" },
  ordem: { type: "integer", minimum: 0 },
  publicadoEm: { type: "string", format: "date-time" },
  apresentacaoTipo: { type: "string", enum: ["video", "pptx", "imagem", "documento", "link"] },
  apresentacaoUrl: { type: "string", maxLength: 2000 },
  apresentacaoTitulo: { type: "string", maxLength: 500 },
  apresentacaoDescricao: { type: "string", maxLength: 2000 },
  apresentacaoImagemUrl: { type: "string", maxLength: 2000 },
  aplicacaoExpectativa: { type: "string", maxLength: 2000 },
};

const createBody = {
  type: "object",
  required: ["titulo", "autorNome"],
  additionalProperties: false,
  properties: trabalhoProps,
};

const updateBody = {
  type: "object",
  required: ["titulo", "autorNome"],
  additionalProperties: false,
  properties: trabalhoProps,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const base = [requireAuth, requireAdmin];
const baseScoped = [...base, requireAmbienteScope];
const tag = ["Admin — Trabalhos"];
const tagPublic = ["Público — Trabalhos"];
const sec = [{ bearerAuth: [] }];

type Reply = { status: (n: number) => { send: (b: unknown) => void } };

function notFound(reply: Reply, msg: string) {
  return reply.status(404).send({ statusCode: 404, error: "Not Found", message: msg });
}

function handleTrabalhoError(reply: Reply, err: unknown): never {
  if (err instanceof TrabalhoNotFoundError) return notFound(reply, (err as Error).message) as never;
  throw err;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function adminTrabalhosRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/ambientes/:ambienteId/trabalhos
  app.get(
    "/admin/ambientes/:ambienteId/trabalhos",
    {
      preHandler: [...baseScoped, requirePermission("trabalhos.visualizar")],
      schema: {
        tags: tag,
        summary: "Lista trabalhos do ambiente",
        security: sec,
        params: pAmbiente,
      },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      return reply.send(await listTrabalhos(ambienteId));
    },
  );

  // POST /admin/ambientes/:ambienteId/trabalhos
  app.post(
    "/admin/ambientes/:ambienteId/trabalhos",
    {
      preHandler: [...baseScoped, requirePermission("trabalhos.criar")],
      schema: {
        tags: tag,
        summary: "Cria trabalho no ambiente",
        security: sec,
        params: pAmbiente,
        body: createBody,
      },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      const trabalho = await createTrabalho(ambienteId, req.body as never);
      await audit({
        usuarioAdminId: req.user.id,
        ambienteId,
        acao: "trabalhos.criar",
        entidade: "trabalhos",
        entidadeId: trabalho.id,
        ip: req.ip,
      });
      return reply.status(201).send(trabalho);
    },
  );

  // GET /admin/ambientes/:ambienteId/trabalhos/:trabalhoId
  app.get(
    "/admin/ambientes/:ambienteId/trabalhos/:trabalhoId",
    {
      preHandler: [...baseScoped, requirePermission("trabalhos.visualizar")],
      schema: {
        tags: tag,
        summary: "Busca trabalho por ID",
        security: sec,
        params: pAmbienteTrabalho,
      },
    },
    async (req, reply) => {
      const { trabalhoId } = req.params as { ambienteId: string; trabalhoId: string };
      try {
        return reply.send(await getTrabalhoById(trabalhoId));
      } catch (err) {
        return handleTrabalhoError(reply, err);
      }
    },
  );

  // PUT /admin/ambientes/:ambienteId/trabalhos/:trabalhoId
  app.put(
    "/admin/ambientes/:ambienteId/trabalhos/:trabalhoId",
    {
      preHandler: [...baseScoped, requirePermission("trabalhos.editar")],
      schema: {
        tags: tag,
        summary: "Atualiza trabalho",
        security: sec,
        params: pAmbienteTrabalho,
        body: updateBody,
      },
    },
    async (req, reply) => {
      const { ambienteId, trabalhoId } = req.params as {
        ambienteId: string;
        trabalhoId: string;
      };
      try {
        const trabalho = await updateTrabalho(trabalhoId, req.body as never);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "trabalhos.editar",
          entidade: "trabalhos",
          entidadeId: trabalhoId,
          dadosNovos: req.body as never,
          ip: req.ip,
        });
        return reply.send(trabalho);
      } catch (err) {
        return handleTrabalhoError(reply, err);
      }
    },
  );

  // DELETE /admin/ambientes/:ambienteId/trabalhos/:trabalhoId
  app.delete(
    "/admin/ambientes/:ambienteId/trabalhos/:trabalhoId",
    {
      preHandler: [...baseScoped, requirePermission("trabalhos.excluir")],
      schema: {
        tags: tag,
        summary: "Exclui trabalho do ambiente",
        security: sec,
        params: pAmbienteTrabalho,
      },
    },
    async (req, reply) => {
      const { ambienteId, trabalhoId } = req.params as {
        ambienteId: string;
        trabalhoId: string;
      };
      try {
        await deleteTrabalho(ambienteId, trabalhoId);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "trabalhos.excluir",
          entidade: "trabalhos",
          entidadeId: trabalhoId,
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        return handleTrabalhoError(reply, err);
      }
    },
  );

  // GET /trabalhos  (public showcase)
  app.get(
    "/trabalhos",
    {
      schema: {
        tags: tagPublic,
        summary: "Lista trabalhos publicados de um ambiente (showcase público)",
        querystring: qAmbiente,
      },
    },
    async (req, reply) => {
      const { ambienteId } = req.query as { ambienteId: string };
      return reply.send(await listTrabalhosPublicos(ambienteId));
    },
  );

  // GET /trabalhos/:trabalhoId  (public showcase)
  app.get(
    "/trabalhos/:trabalhoId",
    {
      schema: {
        tags: tagPublic,
        summary: "Detalhe de trabalho publicado (showcase público)",
        params: pTrabalho,
        querystring: qAmbiente,
      },
    },
    async (req, reply) => {
      const { trabalhoId } = req.params as { trabalhoId: string };
      const { ambienteId } = req.query as { ambienteId: string };
      try {
        return reply.send(await getTrabalhoPublico(ambienteId, trabalhoId));
      } catch (err) {
        return handleTrabalhoError(reply, err);
      }
    },
  );
}
