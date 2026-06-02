import type { FastifyInstance } from "fastify";
import { requireAlunoAuth } from "../../middleware/require-aluno-auth.js";
import {
  AlunoAccountNotFoundError,
  checkAlunoAccessToAmbiente,
  getAlunoProfile,
  listAmbientesDoAluno,
} from "../../services/aluno-account.service.js";

const pSlug = {
  type: "object",
  additionalProperties: false,
  properties: { slug: { type: "string", minLength: 1, maxLength: 120 } },
  required: ["slug"],
};

export async function alunoAccountRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/aluno/me",
    {
      preHandler: requireAlunoAuth,
      schema: {
        tags: ["Aluno — Conta"],
        summary: "Retorna perfil do aluno autenticado",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      try {
        return reply.send(await getAlunoProfile(req.user.id));
      } catch (error) {
        if (error instanceof AlunoAccountNotFoundError) {
          return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: error.message });
        }
        throw error;
      }
    },
  );

  app.get(
    "/aluno/ambientes/:slug/access",
    {
      preHandler: requireAlunoAuth,
      schema: {
        tags: ["Aluno — Conta"],
        summary: "Confere se aluno autenticado pode acessar o ambiente",
        security: [{ bearerAuth: [] }],
        params: pSlug,
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      return reply.send(await checkAlunoAccessToAmbiente(slug, req.user.id));
    },
  );

  app.get(
    "/aluno/me/ambientes",
    {
      preHandler: requireAlunoAuth,
      schema: {
        tags: ["Aluno — Conta"],
        summary: "Lista ambientes ativos do aluno autenticado",
        security: [{ bearerAuth: [] }],
      },
    },
    async (req, reply) => {
      try {
        return reply.send(await listAmbientesDoAluno(req.user.id));
      } catch (error) {
        if (error instanceof AlunoAccountNotFoundError) {
          return reply.send({ aluno: null, ambientes: [] });
        }
        throw error;
      }
    },
  );
}
