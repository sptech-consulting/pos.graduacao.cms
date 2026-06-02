import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/require-admin.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { audit } from "../../services/audit.service.js";
import {
  FerramentaNotFoundError,
  SubRecursoNotFoundError,
  addBloco,
  addCasoTeste,
  addCasoUso,
  addFuncionalidade,
  addTag,
  createFerramenta,
  deleteFerramenta,
  getFerramentaById,
  listFerramentas,
  removeBloco,
  removeCasoTeste,
  removeCasoUso,
  removeFuncionalidade,
  removeTag,
  updateFerramenta,
} from "../../services/ferramentas.service.js";

// ── Param schemas ─────────────────────────────────────────────────────────────

const pFerramenta = {
  type: "object",
  properties: { ferramentaId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["ferramentaId"],
};

const pFerramentaItem = {
  type: "object",
  properties: {
    ferramentaId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    itemId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
  },
  required: ["ferramentaId", "itemId"],
};

// ── Body schemas ──────────────────────────────────────────────────────────────

const ferramentaBody = {
  type: "object",
  required: ["nome"],
  additionalProperties: false,
  properties: {
    nome: { type: "string", minLength: 1, maxLength: 500 },
    subtitulo: { type: "string" },
    descricao: { type: "string" },
    descricaoLonga: { type: "string" },
    url: { type: "string" },
    iconeUrl: { type: "string" },
    imagemCapaUrl: { type: "string" },
    fraseDestaque: { type: "string" },
    categoria: { type: "string", maxLength: 255 },
    tipoAbertura: { type: "string", enum: ["nova_aba", "mesma_aba", "modal"] },
    status: { type: "string", enum: ["ativo", "inativo"] },
  },
};

const ferramentaUpdateBody = { ...ferramentaBody, required: [] };

const casoUsoBody = {
  type: "object",
  required: ["texto"],
  additionalProperties: false,
  properties: {
    texto: { type: "string", minLength: 1 },
    ordem: { type: "integer", minimum: 0 },
  },
};

const tagBody = {
  type: "object",
  required: ["tipo", "rotulo"],
  additionalProperties: false,
  properties: {
    tipo: { type: "string", enum: ["input", "output", "integracao"] },
    rotulo: { type: "string", minLength: 1 },
    ordem: { type: "integer", minimum: 0 },
  },
};

const blocoBody = {
  type: "object",
  required: ["titulo", "conteudo"],
  additionalProperties: false,
  properties: {
    titulo: { type: "string", minLength: 1 },
    conteudo: { type: "string", minLength: 1 },
    ordem: { type: "integer", minimum: 0 },
  },
};

const funcionalidadeBody = {
  type: "object",
  required: ["titulo"],
  additionalProperties: false,
  properties: {
    titulo: { type: "string", minLength: 1 },
    descricao: { type: "string" },
    imagemUrl: { type: "string" },
    ordem: { type: "integer", minimum: 0 },
  },
};

const casoTesteBody = {
  type: "object",
  required: ["titulo"],
  additionalProperties: false,
  properties: {
    titulo: { type: "string", minLength: 1 },
    badge: { type: "string" },
    promptExemplo: { type: "string" },
    explicacao: { type: "string" },
    ordem: { type: "integer", minimum: 0 },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const base = [requireAuth, requireAdmin];
const tag = ["Admin — Ferramentas"];
const sec = [{ bearerAuth: [] }];

type Reply = { status: (n: number) => { send: (b: unknown) => void } };

function notFound(reply: Reply, msg: string) {
  return reply.status(404).send({ statusCode: 404, error: "Not Found", message: msg });
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function adminFerramentasRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/ferramentas
  app.get(
    "/admin/ferramentas",
    {
      preHandler: [...base, requirePermission("ferramentas.visualizar")],
      schema: { tags: tag, summary: "Lista ferramentas", security: sec },
    },
    async (_req, reply) => reply.send(await listFerramentas()),
  );

  // POST /admin/ferramentas
  app.post(
    "/admin/ferramentas",
    {
      preHandler: [...base, requirePermission("ferramentas.criar")],
      schema: { tags: tag, summary: "Cria ferramenta", security: sec, body: ferramentaBody },
    },
    async (req, reply) => {
      const ferramenta = await createFerramenta(req.body as never, req.user.id);
      await audit({
        usuarioAdminId: req.user.id,
        acao: "ferramentas.criar",
        entidade: "ferramentas",
        entidadeId: ferramenta.id,
        ip: req.ip,
      });
      return reply.status(201).send(ferramenta);
    },
  );

  // GET /admin/ferramentas/:ferramentaId
  app.get(
    "/admin/ferramentas/:ferramentaId",
    {
      preHandler: [...base, requirePermission("ferramentas.visualizar")],
      schema: {
        tags: tag,
        summary: "Busca ferramenta com sub-recursos",
        security: sec,
        params: pFerramenta,
      },
    },
    async (req, reply) => {
      const { ferramentaId } = req.params as { ferramentaId: string };
      const ferramenta = await getFerramentaById(ferramentaId);
      if (!ferramenta) return notFound(reply, `Ferramenta não encontrada: ${ferramentaId}`);
      return reply.send(ferramenta);
    },
  );

  // PATCH /admin/ferramentas/:ferramentaId
  app.patch(
    "/admin/ferramentas/:ferramentaId",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: {
        tags: tag,
        summary: "Atualiza ferramenta",
        security: sec,
        params: pFerramenta,
        body: ferramentaUpdateBody,
      },
    },
    async (req, reply) => {
      const { ferramentaId } = req.params as { ferramentaId: string };
      try {
        const ferramenta = await updateFerramenta(ferramentaId, req.body as never);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "ferramentas.editar",
          entidade: "ferramentas",
          entidadeId: ferramentaId,
          dadosNovos: req.body as never,
          ip: req.ip,
        });
        return reply.send(ferramenta);
      } catch (err) {
        if (err instanceof FerramentaNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );

  // DELETE /admin/ferramentas/:ferramentaId
  app.delete(
    "/admin/ferramentas/:ferramentaId",
    {
      preHandler: [...base, requirePermission("ferramentas.excluir")],
      schema: {
        tags: tag,
        summary: "Remove ferramenta (cascade)",
        security: sec,
        params: pFerramenta,
      },
    },
    async (req, reply) => {
      const { ferramentaId } = req.params as { ferramentaId: string };
      try {
        await deleteFerramenta(ferramentaId);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "ferramentas.excluir",
          entidade: "ferramentas",
          entidadeId: ferramentaId,
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof FerramentaNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );

  // ── Sub-recursos ────────────────────────────────────────────────────────────

  type SubParams = { ferramentaId: string; itemId: string };

  function subNotFound(reply: Reply, err: unknown) {
    if (err instanceof FerramentaNotFoundError || err instanceof SubRecursoNotFoundError)
      return notFound(reply, (err as Error).message);
    throw err;
  }

  // POST /admin/ferramentas/:ferramentaId/casos-uso
  app.post(
    "/admin/ferramentas/:ferramentaId/casos-uso",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: {
        tags: tag,
        summary: "Adiciona caso de uso",
        security: sec,
        params: pFerramenta,
        body: casoUsoBody,
      },
    },
    async (req, reply) => {
      const { ferramentaId } = req.params as { ferramentaId: string };
      try {
        const item = await addCasoUso(ferramentaId, req.body as never);
        return reply.status(201).send(item);
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // DELETE /admin/ferramentas/:ferramentaId/casos-uso/:itemId
  app.delete(
    "/admin/ferramentas/:ferramentaId/casos-uso/:itemId",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: { tags: tag, summary: "Remove caso de uso", security: sec, params: pFerramentaItem },
    },
    async (req, reply) => {
      const { ferramentaId, itemId } = req.params as SubParams;
      try {
        await removeCasoUso(ferramentaId, itemId);
        return reply.status(204).send();
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // POST /admin/ferramentas/:ferramentaId/tags
  app.post(
    "/admin/ferramentas/:ferramentaId/tags",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: {
        tags: tag,
        summary: "Adiciona tag",
        security: sec,
        params: pFerramenta,
        body: tagBody,
      },
    },
    async (req, reply) => {
      const { ferramentaId } = req.params as { ferramentaId: string };
      try {
        const item = await addTag(ferramentaId, req.body as never);
        return reply.status(201).send(item);
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // DELETE /admin/ferramentas/:ferramentaId/tags/:itemId
  app.delete(
    "/admin/ferramentas/:ferramentaId/tags/:itemId",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: { tags: tag, summary: "Remove tag", security: sec, params: pFerramentaItem },
    },
    async (req, reply) => {
      const { ferramentaId, itemId } = req.params as SubParams;
      try {
        await removeTag(ferramentaId, itemId);
        return reply.status(204).send();
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // POST /admin/ferramentas/:ferramentaId/blocos
  app.post(
    "/admin/ferramentas/:ferramentaId/blocos",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: {
        tags: tag,
        summary: "Adiciona bloco",
        security: sec,
        params: pFerramenta,
        body: blocoBody,
      },
    },
    async (req, reply) => {
      const { ferramentaId } = req.params as { ferramentaId: string };
      try {
        const item = await addBloco(ferramentaId, req.body as never);
        return reply.status(201).send(item);
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // DELETE /admin/ferramentas/:ferramentaId/blocos/:itemId
  app.delete(
    "/admin/ferramentas/:ferramentaId/blocos/:itemId",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: { tags: tag, summary: "Remove bloco", security: sec, params: pFerramentaItem },
    },
    async (req, reply) => {
      const { ferramentaId, itemId } = req.params as SubParams;
      try {
        await removeBloco(ferramentaId, itemId);
        return reply.status(204).send();
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // POST /admin/ferramentas/:ferramentaId/funcionalidades
  app.post(
    "/admin/ferramentas/:ferramentaId/funcionalidades",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: {
        tags: tag,
        summary: "Adiciona funcionalidade",
        security: sec,
        params: pFerramenta,
        body: funcionalidadeBody,
      },
    },
    async (req, reply) => {
      const { ferramentaId } = req.params as { ferramentaId: string };
      try {
        const item = await addFuncionalidade(ferramentaId, req.body as never);
        return reply.status(201).send(item);
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // DELETE /admin/ferramentas/:ferramentaId/funcionalidades/:itemId
  app.delete(
    "/admin/ferramentas/:ferramentaId/funcionalidades/:itemId",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: {
        tags: tag,
        summary: "Remove funcionalidade",
        security: sec,
        params: pFerramentaItem,
      },
    },
    async (req, reply) => {
      const { ferramentaId, itemId } = req.params as SubParams;
      try {
        await removeFuncionalidade(ferramentaId, itemId);
        return reply.status(204).send();
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // POST /admin/ferramentas/:ferramentaId/casos-teste
  app.post(
    "/admin/ferramentas/:ferramentaId/casos-teste",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: {
        tags: tag,
        summary: "Adiciona caso de teste",
        security: sec,
        params: pFerramenta,
        body: casoTesteBody,
      },
    },
    async (req, reply) => {
      const { ferramentaId } = req.params as { ferramentaId: string };
      try {
        const item = await addCasoTeste(ferramentaId, req.body as never);
        return reply.status(201).send(item);
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );

  // DELETE /admin/ferramentas/:ferramentaId/casos-teste/:itemId
  app.delete(
    "/admin/ferramentas/:ferramentaId/casos-teste/:itemId",
    {
      preHandler: [...base, requirePermission("ferramentas.editar")],
      schema: {
        tags: tag,
        summary: "Remove caso de teste",
        security: sec,
        params: pFerramentaItem,
      },
    },
    async (req, reply) => {
      const { ferramentaId, itemId } = req.params as SubParams;
      try {
        await removeCasoTeste(ferramentaId, itemId);
        return reply.status(204).send();
      } catch (err) {
        return subNotFound(reply, err);
      }
    },
  );
}
