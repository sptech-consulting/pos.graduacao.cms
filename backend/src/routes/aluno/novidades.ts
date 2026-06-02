import type { FastifyInstance } from "fastify";
import { requireAlunoAmbiente } from "../../middleware/require-aluno-ambiente.js";
import { requireAlunoAuth } from "../../middleware/require-aluno-auth.js";
import {
  AlunoNovidadeAccessDeniedError,
  AlunoNovidadeAlunoNotFoundError,
  AlunoNovidadeAmbienteNotFoundError,
  AlunoNovidadeNotFoundError,
  getAlunoNovidadeDetalhe,
} from "../../services/aluno-novidades.service.js";

const pNovidade = {
  type: "object",
  properties: {
    slug: { type: "string", minLength: 1, maxLength: 120 },
    novidadeId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
  },
  required: ["slug", "novidadeId"],
};

export async function alunoNovidadesRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/aluno/ambientes/:slug/novidades/:novidadeId",
    {
      preHandler: [requireAlunoAuth, requireAlunoAmbiente],
      schema: {
        tags: ["Aluno — Novidades"],
        summary: "Carrega detalhe de novidade publicada para aluno do ambiente",
        security: [{ bearerAuth: [] }],
        params: pNovidade,
      },
    },
    async (req, reply) => {
      const { slug, novidadeId } = req.params as { slug: string; novidadeId: string };
      const alunoId = req.user.id;

      try {
        const novidade = await getAlunoNovidadeDetalhe(slug, novidadeId, alunoId);
        return reply.send(novidade);
      } catch (error) {
        if (error instanceof AlunoNovidadeAmbienteNotFoundError || error instanceof AlunoNovidadeNotFoundError) {
          return reply.status(404).send({ statusCode: 404, error: "Not Found", message: error.message });
        }

        if (error instanceof AlunoNovidadeAlunoNotFoundError || error instanceof AlunoNovidadeAccessDeniedError) {
          return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: error.message });
        }

        throw error;
      }
    },
  );
}
