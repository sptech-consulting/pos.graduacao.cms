import type { FastifyInstance } from "fastify";
import { requireAdmin } from "../../middleware/require-admin.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { audit } from "../../services/audit.service.js";
import {
  AulaNotFoundError,
  CursoHasModulosError,
  CursoNotFoundError,
  ModuloHasAulasError,
  ModuloNotFoundError,
  createAula,
  createCurso,
  createModulo,
  deleteAula,
  deleteCurso,
  deleteModulo,
  getCursoById,
  listAulasByModulo,
  listCursos,
  listModulosByCurso,
  updateAula,
  updateCurso,
  updateModulo,
} from "../../services/cursos.service.js";

// ── Schemas ───────────────────────────────────────────────────────────────────

const uuidCurso = {
  type: "object",
  properties: { cursoId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["cursoId"],
};

const uuidModulo = {
  type: "object",
  properties: { moduloId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["moduloId"],
};

const uuidAula = {
  type: "object",
  properties: { aulaId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["aulaId"],
};

const cursoBody = {
  type: "object",
  required: ["titulo"],
  additionalProperties: false,
  properties: {
    titulo: { type: "string", minLength: 1, maxLength: 500 },
    descricao: { type: "string" },
    capaUrl: { type: "string" },
    categoria: { type: "string", maxLength: 255 },
    cargaHorariaMinutos: { type: "integer", minimum: 0 },
    nivel: { type: "string", maxLength: 100 },
    status: { type: "string", enum: ["rascunho", "publicada", "arquivada"] },
  },
};

const cursoUpdateBody = { ...cursoBody, required: [] };

const moduloBody = {
  type: "object",
  required: ["titulo"],
  additionalProperties: false,
  properties: {
    titulo: { type: "string", minLength: 1, maxLength: 500 },
    descricao: { type: "string" },
    ordem: { type: "integer", minimum: 0 },
    status: { type: "string", enum: ["ativo", "inativo"] },
  },
};

const moduloUpdateBody = { ...moduloBody, required: [] };

const aulaBody = {
  type: "object",
  required: ["titulo"],
  additionalProperties: false,
  properties: {
    titulo: { type: "string", minLength: 1, maxLength: 500 },
    descricao: { type: "string" },
    videoUrl: { type: "string" },
    materialUrl: { type: "string" },
    thumbnailUrl: { type: "string" },
    duracaoMinutos: { type: "integer", minimum: 0 },
    tipoConteudo: { type: "string", enum: ["video", "texto", "pdf", "link", "misto"] },
    status: { type: "string", enum: ["rascunho", "publicada", "arquivada"] },
    ordem: { type: "integer", minimum: 0 },
  },
};

const aulaUpdateBody = { ...aulaBody, required: [] };

// ── Helpers ───────────────────────────────────────────────────────────────────

const base = [requireAuth, requireAdmin];
const tags = { cursos: ["Admin — Cursos"], modulos: ["Admin — Módulos"], aulas: ["Admin — Aulas"] };
const sec = [{ bearerAuth: [] }];

function notFound(reply: { status: (n: number) => { send: (b: unknown) => void } }, msg: string) {
  return reply.status(404).send({ statusCode: 404, error: "Not Found", message: msg });
}

function conflict(reply: { status: (n: number) => { send: (b: unknown) => void } }, msg: string) {
  return reply.status(409).send({ statusCode: 409, error: "Conflict", message: msg });
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function adminCursosRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/cursos
  app.get(
    "/admin/cursos",
    {
      preHandler: [...base, requirePermission("cursos.visualizar")],
      schema: { tags: tags.cursos, summary: "Lista cursos", security: sec },
    },
    async (_req, reply) => reply.send(await listCursos()),
  );

  // POST /admin/cursos
  app.post(
    "/admin/cursos",
    {
      preHandler: [...base, requirePermission("cursos.criar")],
      schema: { tags: tags.cursos, summary: "Cria curso", security: sec, body: cursoBody },
    },
    async (req, reply) => {
      const curso = await createCurso(req.body as never, req.user.id);
      await audit({
        usuarioAdminId: req.user.id,
        acao: "cursos.criar",
        entidade: "cursos",
        entidadeId: curso.id,
        ip: req.ip,
      });
      return reply.status(201).send(curso);
    },
  );

  // GET /admin/cursos/:cursoId
  app.get(
    "/admin/cursos/:cursoId",
    {
      preHandler: [...base, requirePermission("cursos.visualizar")],
      schema: {
        tags: tags.cursos,
        summary: "Busca curso por ID",
        security: sec,
        params: uuidCurso,
      },
    },
    async (req, reply) => {
      const { cursoId } = req.params as { cursoId: string };
      const curso = await getCursoById(cursoId);
      if (!curso) return notFound(reply, `Curso não encontrado: ${cursoId}`);
      return reply.send(curso);
    },
  );

  // PATCH /admin/cursos/:cursoId
  app.patch(
    "/admin/cursos/:cursoId",
    {
      preHandler: [...base, requirePermission("cursos.editar")],
      schema: {
        tags: tags.cursos,
        summary: "Atualiza curso",
        security: sec,
        params: uuidCurso,
        body: cursoUpdateBody,
      },
    },
    async (req, reply) => {
      const { cursoId } = req.params as { cursoId: string };
      try {
        const curso = await updateCurso(cursoId, req.body as never);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "cursos.editar",
          entidade: "cursos",
          entidadeId: cursoId,
          dadosNovos: req.body as never,
          ip: req.ip,
        });
        return reply.send(curso);
      } catch (err) {
        if (err instanceof CursoNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );

  // DELETE /admin/cursos/:cursoId
  app.delete(
    "/admin/cursos/:cursoId",
    {
      preHandler: [...base, requirePermission("cursos.excluir")],
      schema: { tags: tags.cursos, summary: "Remove curso", security: sec, params: uuidCurso },
    },
    async (req, reply) => {
      const { cursoId } = req.params as { cursoId: string };
      try {
        await deleteCurso(cursoId);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "cursos.excluir",
          entidade: "cursos",
          entidadeId: cursoId,
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof CursoNotFoundError) return notFound(reply, err.message);
        if (err instanceof CursoHasModulosError) return conflict(reply, err.message);
        throw err;
      }
    },
  );

  // GET /admin/cursos/:cursoId/modulos
  app.get(
    "/admin/cursos/:cursoId/modulos",
    {
      preHandler: [...base, requirePermission("cursos.visualizar")],
      schema: {
        tags: tags.modulos,
        summary: "Lista módulos do curso",
        security: sec,
        params: uuidCurso,
      },
    },
    async (req, reply) => {
      const { cursoId } = req.params as { cursoId: string };
      return reply.send(await listModulosByCurso(cursoId));
    },
  );

  // POST /admin/cursos/:cursoId/modulos
  app.post(
    "/admin/cursos/:cursoId/modulos",
    {
      preHandler: [...base, requirePermission("cursos.editar")],
      schema: {
        tags: tags.modulos,
        summary: "Cria módulo no curso",
        security: sec,
        params: uuidCurso,
        body: moduloBody,
      },
    },
    async (req, reply) => {
      const { cursoId } = req.params as { cursoId: string };
      try {
        const modulo = await createModulo(cursoId, req.body as never);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "modulos.criar",
          entidade: "modulos",
          entidadeId: modulo.id,
          ip: req.ip,
        });
        return reply.status(201).send(modulo);
      } catch (err) {
        if (err instanceof CursoNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );

  // PATCH /admin/modulos/:moduloId
  app.patch(
    "/admin/modulos/:moduloId",
    {
      preHandler: [...base, requirePermission("cursos.editar")],
      schema: {
        tags: tags.modulos,
        summary: "Atualiza módulo",
        security: sec,
        params: uuidModulo,
        body: moduloUpdateBody,
      },
    },
    async (req, reply) => {
      const { moduloId } = req.params as { moduloId: string };
      try {
        const modulo = await updateModulo(moduloId, req.body as never);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "modulos.editar",
          entidade: "modulos",
          entidadeId: moduloId,
          dadosNovos: req.body as never,
          ip: req.ip,
        });
        return reply.send(modulo);
      } catch (err) {
        if (err instanceof ModuloNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );

  // DELETE /admin/modulos/:moduloId
  app.delete(
    "/admin/modulos/:moduloId",
    {
      preHandler: [...base, requirePermission("cursos.excluir")],
      schema: { tags: tags.modulos, summary: "Remove módulo", security: sec, params: uuidModulo },
    },
    async (req, reply) => {
      const { moduloId } = req.params as { moduloId: string };
      try {
        await deleteModulo(moduloId);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "modulos.excluir",
          entidade: "modulos",
          entidadeId: moduloId,
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof ModuloNotFoundError) return notFound(reply, err.message);
        if (err instanceof ModuloHasAulasError) return conflict(reply, err.message);
        throw err;
      }
    },
  );

  // GET /admin/modulos/:moduloId/aulas
  app.get(
    "/admin/modulos/:moduloId/aulas",
    {
      preHandler: [...base, requirePermission("cursos.visualizar")],
      schema: {
        tags: tags.aulas,
        summary: "Lista aulas do módulo",
        security: sec,
        params: uuidModulo,
      },
    },
    async (req, reply) => {
      const { moduloId } = req.params as { moduloId: string };
      return reply.send(await listAulasByModulo(moduloId));
    },
  );

  // POST /admin/modulos/:moduloId/aulas
  app.post(
    "/admin/modulos/:moduloId/aulas",
    {
      preHandler: [...base, requirePermission("cursos.editar")],
      schema: {
        tags: tags.aulas,
        summary: "Cria aula no módulo",
        security: sec,
        params: uuidModulo,
        body: aulaBody,
      },
    },
    async (req, reply) => {
      const { moduloId } = req.params as { moduloId: string };
      try {
        const aula = await createAula(moduloId, req.body as never, req.user.id);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "aulas.criar",
          entidade: "aulas",
          entidadeId: aula.id,
          ip: req.ip,
        });
        return reply.status(201).send(aula);
      } catch (err) {
        if (err instanceof ModuloNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );

  // PATCH /admin/aulas/:aulaId
  app.patch(
    "/admin/aulas/:aulaId",
    {
      preHandler: [...base, requirePermission("cursos.editar")],
      schema: {
        tags: tags.aulas,
        summary: "Atualiza aula",
        security: sec,
        params: uuidAula,
        body: aulaUpdateBody,
      },
    },
    async (req, reply) => {
      const { aulaId } = req.params as { aulaId: string };
      try {
        const aula = await updateAula(aulaId, req.body as never);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "aulas.editar",
          entidade: "aulas",
          entidadeId: aulaId,
          dadosNovos: req.body as never,
          ip: req.ip,
        });
        return reply.send(aula);
      } catch (err) {
        if (err instanceof AulaNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );

  // DELETE /admin/aulas/:aulaId
  app.delete(
    "/admin/aulas/:aulaId",
    {
      preHandler: [...base, requirePermission("cursos.excluir")],
      schema: { tags: tags.aulas, summary: "Remove aula", security: sec, params: uuidAula },
    },
    async (req, reply) => {
      const { aulaId } = req.params as { aulaId: string };
      try {
        await deleteAula(aulaId);
        await audit({
          usuarioAdminId: req.user.id,
          acao: "aulas.excluir",
          entidade: "aulas",
          entidadeId: aulaId,
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        if (err instanceof AulaNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );
}
