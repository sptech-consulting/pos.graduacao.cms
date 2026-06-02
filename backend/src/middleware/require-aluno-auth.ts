import { eq } from "drizzle-orm";
import type { FastifyReply, FastifyRequest } from "fastify";
import { db } from "../db/connection.js";
import { alunos } from "../db/schema/index.js";

/**
 * Verifies the JWT belongs to an active aluno.
 * Rejects admins, inactive, and blocked alunos.
 * Must be used after JWT plugin registration.
 */
export async function requireAlunoAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  try {
    await req.jwtVerify();
  } catch {
    reply.status(401).send({ statusCode: 401, error: "Unauthorized", message: "Token inválido ou ausente." });
    return;
  }

  if (req.user.role !== "aluno") {
    reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Acesso negado." });
    return;
  }

  const [aluno] = await db
    .select({ id: alunos.id, status: alunos.status })
    .from(alunos)
    .where(eq(alunos.id, req.user.id))
    .limit(1);

  if (!aluno || aluno.status !== "ativo") {
    reply.status(403).send({ statusCode: 403, error: "Forbidden", message: "Acesso negado." });
  }
}
