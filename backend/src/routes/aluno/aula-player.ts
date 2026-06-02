import type { FastifyInstance } from "fastify";
import { requireAlunoAmbiente } from "../../middleware/require-aluno-ambiente.js";
import { requireAlunoAuth } from "../../middleware/require-aluno-auth.js";
import {
  AlunoAulaAccessDeniedError,
  AlunoAulaAlunoNotFoundError,
  AlunoAulaAmbienteNotFoundError,
  AlunoAulaComentarioForbiddenError,
  AlunoAulaComentarioNotFoundError,
  AlunoAulaComentarioRateLimitError,
  AlunoAulaNotFoundError,
  createAlunoAulaComentario,
  getAlunoAulaPlayer,
  removeAlunoAulaComentario,
  saveAlunoAulaProgresso,
  setAlunoAulaConclusao,
  toggleAlunoAulaComentarioCurtida,
} from "../../services/aluno-aula-player.service.js";

const aulaParams = {
  type: "object",
  additionalProperties: false,
  properties: {
    slug: { type: "string", minLength: 1, maxLength: 120 },
    aulaId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
  },
  required: ["slug", "aulaId"],
};

const comentarioParams = {
  type: "object",
  additionalProperties: false,
  properties: {
    slug: { type: "string", minLength: 1, maxLength: 120 },
    aulaId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
    comentarioId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
  },
  required: ["slug", "aulaId", "comentarioId"],
};

const conclusaoBody = {
  type: "object",
  additionalProperties: false,
  properties: { concluida: { type: "boolean" } },
  required: ["concluida"],
};

const progressoBody = {
  type: "object",
  additionalProperties: false,
  properties: { segundos: { type: "number", minimum: 0, maximum: 86400 }, concluida: { type: "boolean" } },
  required: ["segundos"],
};

const comentarioBody = {
  type: "object",
  additionalProperties: false,
  properties: {
    conteudo: { type: "string", minLength: 1, maxLength: 4000 },
    parentId: { anyOf: [{ type: "string", pattern: "^[0-9a-f-]{36}$" }, { type: "null" }] },
  },
  required: ["conteudo"],
};

function respondError(reply: { status: (n: number) => { send: (b: unknown) => unknown } }, error: unknown) {
  if (error instanceof AlunoAulaAmbienteNotFoundError || error instanceof AlunoAulaNotFoundError || error instanceof AlunoAulaComentarioNotFoundError) {
    return reply.status(404).send({ statusCode: 404, error: "Not Found", message: error.message });
  }
  if (error instanceof AlunoAulaAlunoNotFoundError || error instanceof AlunoAulaAccessDeniedError || error instanceof AlunoAulaComentarioForbiddenError) {
    return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: error.message });
  }
  if (error instanceof AlunoAulaComentarioRateLimitError) {
    return reply.status(429).send({ statusCode: 429, error: "Too Many Requests", message: error.message });
  }

  throw error;
}

function hasUnexpectedKeys(body: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(body).some((key) => !allowed.includes(key));
}

export async function alunoAulaPlayerRoutes(app: FastifyInstance): Promise<void> {
  const auth = [requireAlunoAuth, requireAlunoAmbiente];

  app.get("/aluno/ambientes/:slug/aulas/:aulaId/player", { preHandler: auth, schema: { tags: ["Aluno — Aula Player"], summary: "Carrega dados do player da aula", security: [{ bearerAuth: [] }], params: aulaParams } }, async (req, reply) => {
    try {
      const { slug, aulaId } = req.params as { slug: string; aulaId: string };
      return reply.send(await getAlunoAulaPlayer(slug, aulaId, req.user.id));
    } catch (error) {
      return respondError(reply, error);
    }
  });

  app.post("/aluno/ambientes/:slug/aulas/:aulaId/conclusao", { preHandler: auth, schema: { tags: ["Aluno — Aula Player"], summary: "Marca aula como concluida", security: [{ bearerAuth: [] }], params: aulaParams, body: conclusaoBody } }, async (req, reply) => {
    try {
      const { slug, aulaId } = req.params as { slug: string; aulaId: string };
      const { concluida } = req.body as { concluida: boolean };
      if (hasUnexpectedKeys(req.body as Record<string, unknown>, ["concluida"])) {
        return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Body contém propriedades não permitidas." });
      }
      return reply.send(await setAlunoAulaConclusao(slug, aulaId, req.user.id, concluida));
    } catch (error) {
      return respondError(reply, error);
    }
  });

  app.post("/aluno/ambientes/:slug/aulas/:aulaId/progresso", { preHandler: auth, schema: { tags: ["Aluno — Aula Player"], summary: "Salva progresso de video da aula", security: [{ bearerAuth: [] }], params: aulaParams, body: progressoBody } }, async (req, reply) => {
    try {
      const { slug, aulaId } = req.params as { slug: string; aulaId: string };
      const { segundos, concluida } = req.body as { segundos: number; concluida?: boolean };
      if (hasUnexpectedKeys(req.body as Record<string, unknown>, ["segundos", "concluida"])) {
        return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Body contém propriedades não permitidas." });
      }
      return reply.send(await saveAlunoAulaProgresso(slug, aulaId, req.user.id, segundos, concluida));
    } catch (error) {
      return respondError(reply, error);
    }
  });

  app.post("/aluno/ambientes/:slug/aulas/:aulaId/comentarios", { preHandler: auth, schema: { tags: ["Aluno — Aula Player"], summary: "Cria comentario na aula", security: [{ bearerAuth: [] }], params: aulaParams, body: comentarioBody } }, async (req, reply) => {
    try {
      const { slug, aulaId } = req.params as { slug: string; aulaId: string };
      const { conteudo, parentId = null } = req.body as { conteudo: string; parentId?: string | null };
      if (hasUnexpectedKeys(req.body as Record<string, unknown>, ["conteudo", "parentId"])) {
        return reply.status(400).send({ statusCode: 400, error: "Bad Request", message: "Body contém propriedades não permitidas." });
      }
      return reply.status(201).send(await createAlunoAulaComentario(slug, aulaId, req.user.id, conteudo, parentId));
    } catch (error) {
      return respondError(reply, error);
    }
  });

  app.delete("/aluno/ambientes/:slug/aulas/:aulaId/comentarios/:comentarioId", { preHandler: auth, schema: { tags: ["Aluno — Aula Player"], summary: "Remove comentario proprio da aula", security: [{ bearerAuth: [] }], params: comentarioParams } }, async (req, reply) => {
    try {
      const { slug, aulaId, comentarioId } = req.params as { slug: string; aulaId: string; comentarioId: string };
      return reply.send(await removeAlunoAulaComentario(slug, aulaId, comentarioId, req.user.id));
    } catch (error) {
      return respondError(reply, error);
    }
  });

  app.post("/aluno/ambientes/:slug/aulas/:aulaId/comentarios/:comentarioId/curtida", { preHandler: auth, schema: { tags: ["Aluno — Aula Player"], summary: "Alterna curtida do comentario da aula", security: [{ bearerAuth: [] }], params: comentarioParams } }, async (req, reply) => {
    try {
      const { slug, aulaId, comentarioId } = req.params as { slug: string; aulaId: string; comentarioId: string };
      return reply.send(await toggleAlunoAulaComentarioCurtida(slug, aulaId, comentarioId, req.user.id));
    } catch (error) {
      return respondError(reply, error);
    }
  });
}
