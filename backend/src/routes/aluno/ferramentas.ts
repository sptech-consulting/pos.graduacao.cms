import type { FastifyInstance } from "fastify";
import { requireAlunoAmbiente } from "../../middleware/require-aluno-ambiente.js";
import { requireAlunoAuth } from "../../middleware/require-aluno-auth.js";
import {
  AlunoFerramentaAccessDeniedError,
  AlunoFerramentaAlunoNotFoundError,
  AlunoFerramentaAmbienteNotFoundError,
  AlunoFerramentaNotFoundError,
  getAlunoFerramentaDetalhe,
} from "../../services/aluno-ferramentas.service.js";

const pFerramenta = {
  type: "object",
  properties: {
    slug: { type: "string", minLength: 1, maxLength: 120 },
    ferramentaId: { type: "string", pattern: "^[0-9a-f-]{36}$" },
  },
  required: ["slug", "ferramentaId"],
};

export async function alunoFerramentasRoutes(app: FastifyInstance): Promise<void> {
  app.get(
    "/aluno/ambientes/:slug/ferramentas/:ferramentaId",
    {
      preHandler: [requireAlunoAuth, requireAlunoAmbiente],
      schema: {
        tags: ["Aluno — Ferramentas"],
        summary: "Carrega detalhe de ferramenta ativa vinculada ao ambiente do aluno",
        security: [{ bearerAuth: [] }],
        params: pFerramenta,
      },
    },
    async (req, reply) => {
      const { slug, ferramentaId } = req.params as { slug: string; ferramentaId: string };
      const alunoId = req.user.id;

      try {
        const ferramenta = await getAlunoFerramentaDetalhe(slug, ferramentaId, alunoId);
        return reply.send(ferramenta);
      } catch (error) {
        if (error instanceof AlunoFerramentaAmbienteNotFoundError || error instanceof AlunoFerramentaNotFoundError) {
          return reply.status(404).send({ statusCode: 404, error: "Not Found", message: error.message });
        }

        if (error instanceof AlunoFerramentaAlunoNotFoundError || error instanceof AlunoFerramentaAccessDeniedError) {
          return reply.status(403).send({ statusCode: 403, error: "Forbidden", message: error.message });
        }

        throw error;
      }
    },
  );
}
