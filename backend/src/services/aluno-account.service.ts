import { and, eq, inArray } from "drizzle-orm";
import { db } from "../db/connection.js";
import { ambienteAlunos, ambientes, alunos } from "../db/schema/index.js";

export type AlunoAccessResult =
  | { ok: true }
  | { ok: false; reason: "no_aluno" | "not_found" | "inativo" | "no_link" };

export class AlunoAccountNotFoundError extends Error {
  constructor(alunoId: string) {
    super(`Aluno não cadastrado ou inativo: ${alunoId}`);
    this.name = "AlunoAccountNotFoundError";
  }
}

async function getAlunoAtivoById(alunoId: string) {
  const [aluno] = await db
    .select({ id: alunos.id, nomeCompleto: alunos.nomeCompleto, emailAcesso: alunos.emailAcesso, status: alunos.status })
    .from(alunos)
    .where(eq(alunos.id, alunoId))
    .limit(1);

  if (!aluno || aluno.status !== "ativo") {
    throw new AlunoAccountNotFoundError(alunoId);
  }

  return aluno;
}

export async function getAlunoProfile(alunoId: string) {
  return getAlunoAtivoById(alunoId);
}

export async function checkAlunoAccessToAmbiente(slug: string, alunoId: string): Promise<AlunoAccessResult> {
  const [ambiente] = await db
    .select({ id: ambientes.id, status: ambientes.status })
    .from(ambientes)
    .where(eq(ambientes.slug, slug))
    .limit(1);

  if (!ambiente) return { ok: false, reason: "not_found" };
  if (ambiente.status !== "ativo") return { ok: false, reason: "inativo" };

  const [aluno] = await db
    .select({ id: alunos.id, status: alunos.status })
    .from(alunos)
    .where(eq(alunos.id, alunoId))
    .limit(1);

  if (!aluno || aluno.status !== "ativo") {
    return { ok: false, reason: "no_aluno" };
  }

  const [vinculo] = await db
    .select({ id: ambienteAlunos.id, status: ambienteAlunos.status })
    .from(ambienteAlunos)
    .where(and(eq(ambienteAlunos.alunoId, aluno.id), eq(ambienteAlunos.ambienteId, ambiente.id)))
    .limit(1);

  if (!vinculo || vinculo.status !== "ativo") {
    return { ok: false, reason: "no_link" };
  }

  return { ok: true };
}

export async function listAmbientesDoAluno(alunoId: string) {
  const aluno = await getAlunoAtivoById(alunoId);

  const vinculos = await db
    .select({ ambienteId: ambienteAlunos.ambienteId })
    .from(ambienteAlunos)
    .where(and(eq(ambienteAlunos.alunoId, aluno.id), eq(ambienteAlunos.status, "ativo")));

  const ambienteIds = [...new Set(vinculos.map((item) => item.ambienteId))];
  const ambientesAtivos = ambienteIds.length
    ? await db
        .select({ id: ambientes.id, nome: ambientes.nome, slug: ambientes.slug, corPrimaria: ambientes.corPrimaria, imagemCapaUrl: ambientes.imagemCapaUrl, status: ambientes.status })
        .from(ambientes)
        .where(and(inArray(ambientes.id, ambienteIds), eq(ambientes.status, "ativo")))
    : [];

  const ambienteById = new Map(ambientesAtivos.map((item) => [item.id, item]));

  return {
    aluno: { nomeCompleto: aluno.nomeCompleto, emailAcesso: aluno.emailAcesso },
    ambientes: ambienteIds
      .map((id) => ambienteById.get(id))
      .filter((item): item is NonNullable<typeof item> => !!item)
      .map((item) => ({
        id: item.id,
        nome: item.nome,
        slug: item.slug,
        corPrimaria: item.corPrimaria,
        imagemCapaUrl: item.imagemCapaUrl,
      })),
  };
}
