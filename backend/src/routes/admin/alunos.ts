import type { FastifyInstance } from "fastify";
import { requireAmbienteScope } from "../../middleware/require-ambiente-scope.js";
import { requireAdmin } from "../../middleware/require-admin.js";
import { requireAuth } from "../../middleware/require-auth.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { audit } from "../../services/audit.service.js";
import {
  AlunoJaVinculadoError,
  AlunoNaoVinculadoError,
  AlunoNotFoundError,
  EmailDuplicadoError,
  ImportacaoNotFoundError,
  createAluno,
  desvincularAluno,
  getAlunoDoAmbiente,
  getImportacaoById,
  importarAlunos,
  listAlunosDoAmbiente,
  listImportacaoErros,
  listImportacoes,
  updateAluno,
  updateAlunoStatus,
} from "../../services/alunos.service.js";

// ── Param schemas ─────────────────────────────────────────────────────────────

const pAmbiente = {
  type: "object",
  properties: { ambienteId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["ambienteId"],
};

const pAmbienteAluno = {
  type: "object",
  properties: {
    ambienteId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    alunoId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
  },
  required: ["ambienteId", "alunoId"],
};

const pImportacao = {
  type: "object",
  properties: { importacaoId: { type: "string", pattern: "^[0-9a-f-]{36}$" } },
  required: ["importacaoId"],
};

// ── Body schemas ──────────────────────────────────────────────────────────────

const createBody = {
  type: "object",
  required: ["nomeCompleto", "emailAcesso"],
  additionalProperties: false,
  properties: {
    nomeCompleto: { type: "string", minLength: 1, maxLength: 500 },
    emailAcesso: { type: "string", format: "email", maxLength: 320 },
    whatsapp: { type: "string", maxLength: 20 },
  },
};

const updateBody = {
  type: "object",
  required: [],
  additionalProperties: false,
  properties: {
    nomeCompleto: { type: "string", minLength: 1, maxLength: 500 },
    emailAcesso: { type: "string", format: "email", maxLength: 320 },
    whatsapp: { type: "string", maxLength: 20 },
  },
};

const statusBody = {
  type: "object",
  required: ["status"],
  additionalProperties: false,
  properties: {
    status: { type: "string", enum: ["ativo", "inativo", "bloqueado"] },
  },
};

const importarBody = {
  type: "object",
  required: ["rows"],
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      minItems: 1,
      maxItems: 500,
      items: {
        type: "object",
        required: ["nomeCompleto", "emailAcesso"],
        additionalProperties: false,
        properties: {
          nomeCompleto: { type: "string", minLength: 1, maxLength: 500 },
          emailAcesso: { type: "string", maxLength: 320 },
          whatsapp: { type: "string", maxLength: 20 },
        },
      },
    },
  },
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const base = [requireAuth, requireAdmin];
const baseScoped = [...base, requireAmbienteScope];
const tag = ["Admin — Alunos"];
const sec = [{ bearerAuth: [] }];

type Reply = { status: (n: number) => { send: (b: unknown) => void } };

function notFound(reply: Reply, msg: string) {
  return reply.status(404).send({ statusCode: 404, error: "Not Found", message: msg });
}

function conflict(reply: Reply, msg: string) {
  return reply.status(409).send({ statusCode: 409, error: "Conflict", message: msg });
}

function handleAlunoError(reply: Reply, err: unknown): never {
  if (err instanceof AlunoNotFoundError || err instanceof AlunoNaoVinculadoError)
    return notFound(reply, (err as Error).message) as never;
  if (err instanceof AlunoJaVinculadoError || err instanceof EmailDuplicadoError)
    return conflict(reply, (err as Error).message) as never;
  throw err;
}

// ── Routes ────────────────────────────────────────────────────────────────────

export async function adminAlunosRoutes(app: FastifyInstance): Promise<void> {
  // GET /admin/ambientes/:ambienteId/alunos
  app.get(
    "/admin/ambientes/:ambienteId/alunos",
    {
      preHandler: [...baseScoped, requirePermission("alunos.visualizar")],
      schema: { tags: tag, summary: "Lista alunos do ambiente", security: sec, params: pAmbiente },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      return reply.send(await listAlunosDoAmbiente(ambienteId));
    },
  );

  // POST /admin/ambientes/:ambienteId/alunos/importar  (must be registered BEFORE /:alunoId)
  app.post(
    "/admin/ambientes/:ambienteId/alunos/importar",
    {
      preHandler: [...baseScoped, requirePermission("alunos.criar")],
      schema: {
        tags: tag,
        summary: "Importa alunos em lote (máx 500)",
        security: sec,
        params: pAmbiente,
        body: importarBody,
      },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      const { rows } = req.body as {
        rows: { nomeCompleto: string; emailAcesso: string; whatsapp?: string }[];
      };
      const result = await importarAlunos(ambienteId, rows, req.user.id);
      await audit({
        usuarioAdminId: req.user.id,
        ambienteId,
        acao: "alunos.importar",
        entidade: "importacoes_alunos",
        entidadeId: result.id,
        ip: req.ip,
      });
      return reply.status(201).send(result);
    },
  );

  // POST /admin/ambientes/:ambienteId/alunos
  app.post(
    "/admin/ambientes/:ambienteId/alunos",
    {
      preHandler: [...baseScoped, requirePermission("alunos.criar")],
      schema: {
        tags: tag,
        summary: "Cria ou vincula aluno ao ambiente",
        security: sec,
        params: pAmbiente,
        body: createBody,
      },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      try {
        const aluno = await createAluno(ambienteId, req.body as never);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "alunos.criar",
          entidade: "alunos",
          entidadeId: aluno.id,
          ip: req.ip,
        });
        return reply.status(201).send(aluno);
      } catch (err) {
        return handleAlunoError(reply, err);
      }
    },
  );

  // GET /admin/ambientes/:ambienteId/alunos/:alunoId
  app.get(
    "/admin/ambientes/:ambienteId/alunos/:alunoId",
    {
      preHandler: [...baseScoped, requirePermission("alunos.visualizar")],
      schema: {
        tags: tag,
        summary: "Busca aluno do ambiente",
        security: sec,
        params: pAmbienteAluno,
      },
    },
    async (req, reply) => {
      const { ambienteId, alunoId } = req.params as { ambienteId: string; alunoId: string };
      try {
        return reply.send(await getAlunoDoAmbiente(ambienteId, alunoId));
      } catch (err) {
        return handleAlunoError(reply, err);
      }
    },
  );

  // PATCH /admin/ambientes/:ambienteId/alunos/:alunoId
  app.patch(
    "/admin/ambientes/:ambienteId/alunos/:alunoId",
    {
      preHandler: [...baseScoped, requirePermission("alunos.editar")],
      schema: {
        tags: tag,
        summary: "Atualiza dados do aluno",
        security: sec,
        params: pAmbienteAluno,
        body: updateBody,
      },
    },
    async (req, reply) => {
      const { ambienteId, alunoId } = req.params as { ambienteId: string; alunoId: string };
      try {
        const aluno = await updateAluno(ambienteId, alunoId, req.body as never);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "alunos.editar",
          entidade: "alunos",
          entidadeId: alunoId,
          dadosNovos: req.body as never,
          ip: req.ip,
        });
        return reply.send(aluno);
      } catch (err) {
        return handleAlunoError(reply, err);
      }
    },
  );

  // PATCH /admin/ambientes/:ambienteId/alunos/:alunoId/status
  app.patch(
    "/admin/ambientes/:ambienteId/alunos/:alunoId/status",
    {
      preHandler: [...baseScoped, requirePermission("alunos.editar")],
      schema: {
        tags: tag,
        summary: "Atualiza status do aluno",
        security: sec,
        params: pAmbienteAluno,
        body: statusBody,
      },
    },
    async (req, reply) => {
      const { ambienteId, alunoId } = req.params as { ambienteId: string; alunoId: string };
      const { status } = req.body as { status: "ativo" | "inativo" | "bloqueado" };
      try {
        await updateAlunoStatus(ambienteId, alunoId, status);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "alunos.status",
          entidade: "alunos",
          entidadeId: alunoId,
          dadosNovos: { status },
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        return handleAlunoError(reply, err);
      }
    },
  );

  // DELETE /admin/ambientes/:ambienteId/alunos/:alunoId
  app.delete(
    "/admin/ambientes/:ambienteId/alunos/:alunoId",
    {
      preHandler: [...baseScoped, requirePermission("alunos.excluir")],
      schema: {
        tags: tag,
        summary: "Desvincula aluno do ambiente",
        security: sec,
        params: pAmbienteAluno,
      },
    },
    async (req, reply) => {
      const { ambienteId, alunoId } = req.params as { ambienteId: string; alunoId: string };
      try {
        await desvincularAluno(ambienteId, alunoId);
        await audit({
          usuarioAdminId: req.user.id,
          ambienteId,
          acao: "alunos.desvincular",
          entidade: "alunos",
          entidadeId: alunoId,
          ip: req.ip,
        });
        return reply.status(204).send();
      } catch (err) {
        return handleAlunoError(reply, err);
      }
    },
  );

  // GET /admin/ambientes/:ambienteId/importacoes
  app.get(
    "/admin/ambientes/:ambienteId/importacoes",
    {
      preHandler: [...baseScoped, requirePermission("alunos.visualizar")],
      schema: {
        tags: tag,
        summary: "Lista importações do ambiente",
        security: sec,
        params: pAmbiente,
      },
    },
    async (req, reply) => {
      const { ambienteId } = req.params as { ambienteId: string };
      return reply.send(await listImportacoes(ambienteId));
    },
  );

  // GET /admin/importacoes/:importacaoId
  app.get(
    "/admin/importacoes/:importacaoId",
    {
      preHandler: [...base, requirePermission("alunos.visualizar")],
      schema: { tags: tag, summary: "Busca importação por ID", security: sec, params: pImportacao },
    },
    async (req, reply) => {
      const { importacaoId } = req.params as { importacaoId: string };
      const importacao = await getImportacaoById(importacaoId);
      if (!importacao) return notFound(reply, `Importação não encontrada: ${importacaoId}`);
      return reply.send(importacao);
    },
  );

  // GET /admin/importacoes/:importacaoId/erros
  app.get(
    "/admin/importacoes/:importacaoId/erros",
    {
      preHandler: [...base, requirePermission("alunos.visualizar")],
      schema: {
        tags: tag,
        summary: "Lista erros da importação",
        security: sec,
        params: pImportacao,
      },
    },
    async (req, reply) => {
      const { importacaoId } = req.params as { importacaoId: string };
      try {
        return reply.send(await listImportacaoErros(importacaoId));
      } catch (err) {
        if (err instanceof ImportacaoNotFoundError) return notFound(reply, err.message);
        throw err;
      }
    },
  );
}
