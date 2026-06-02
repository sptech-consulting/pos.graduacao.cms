import { and, eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/connection.js";
import { ambienteAlunos, ambientes } from "../db/schema/index.js";

/**
 * Verifies the authenticated aluno has an active link to the ambiente
 * identified by the :slug route param.
 *
 * Checks in order:
 *   1. Ambiente exists and is ativo
 *   2. Aluno has an active ambiente_alunos record for it
 *
 * Prevents IDOR: aluno from ambiente A cannot access ambiente B by guessing slugs.
 * Must be used after requireAlunoAuth.
 */
export async function requireAlunoAmbiente(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { slug } = req.params as { slug?: string };
  if (!slug) return;

  const [ambiente] = await db
    .select({ id: ambientes.id, status: ambientes.status })
    .from(ambientes)
    .where(eq(ambientes.slug, slug))
    .limit(1);

  if (!ambiente) {
    reply.status(404).send({ statusCode: 404, error: "Not Found", message: "Ambiente não encontrado." });
    return;
  }

  if (ambiente.status !== "ativo") {
    reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Ambiente indisponível." });
    return;
  }

  const [vinculo] = await db
    .select({ id: ambienteAlunos.id })
    .from(ambienteAlunos)
    .where(
      and(
        eq(ambienteAlunos.alunoId, req.user.id),
        eq(ambienteAlunos.ambienteId, ambiente.id),
        eq(ambienteAlunos.status, "ativo"),
      ),
    )
    .limit(1);

  if (!vinculo) {
    reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Sem acesso a este ambiente." });
  }
}
