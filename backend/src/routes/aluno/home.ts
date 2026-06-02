import type { FastifyInstance } from "fastify";
import { requireAlunoAmbiente } from "../../middleware/require-aluno-ambiente.js";
import { requireAlunoAuth } from "../../middleware/require-aluno-auth.js";
import {
  AlunoHomeAccessDeniedError,
  AlunoHomeAlunoNotFoundError,
  AlunoHomeAmbienteNotFoundError,
  getAlunoAmbienteHome,
} from "../../services/aluno-home.service.js";

const pSlug = {
  type: "object",
  properties: {
    slug: { type: "string", minLength: 1, maxLength: 120 },
  },
  required: ["slug"],
};

export async function alunoHomeRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/aluno/ambientes/:slug/home",
    {
      preHandler: [requireAlunoAuth, requireAlunoAmbiente],
      schema: {
        tags: ["Aluno — Home"],
        summary: "Carrega dados da home do aluno no ambiente",
        security: [{ bearerAuth: [] }],
        params: pSlug,
      },
    },
    async (req, reply) => {
      const { slug } = req.params as { slug: string };
      const alunoId = req.user.id;

      try {
        const payload = await getAlunoAmbienteHome(slug, alunoId);
        return reply.send(payload);
      } catch (error) {
        if (error instanceof AlunoHomeAmbienteNotFoundError) {
          return reply.status(404).send({ statusCode: 404, error: "Not Found", message: error.message });
        }

        if (error instanceof AlunoHomeAlunoNotFoundError || error instanceof AlunoHomeAccessDeniedError) {
          return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: error.message });
        }

        throw error;
      }
    },
  );
}
