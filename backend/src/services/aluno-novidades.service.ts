import { and, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { ambienteAlunos, ambientes, alunos, novidades } from "../db/schema/index.js";

export type AlunoNovidadeDetalhe = {
  id: string;
  titulo: string;
  resumo: string | null;
  conteudo: string | null;
  imagemUrl: string | null;
  fonteUrl: string | null;
  fonteNome: string | null;
  categoria: string | null;
  publicadoEm: Date | null;
  ambienteSlug: string;
  ambienteNome: string;
};

export class AlunoNovidadeAmbienteNotFoundError extends Error {
  constructor(slug: string) {
    super(`Ambiente não encontrado ou inativo: ${slug}`);
    this.name = "AlunoNovidadeAmbienteNotFoundError";
  }
}

export class AlunoNovidadeAlunoNotFoundError extends Error {
  constructor(alunoId: string) {
    super(`Aluno não cadastrado ou inativo: ${alunoId}`);
    this.name = "AlunoNovidadeAlunoNotFoundError";
  }
}

export class AlunoNovidadeAccessDeniedError extends Error {
  constructor(alunoId: string, slug: string) {
    super(`Aluno ${alunoId} sem acesso a este ambiente: ${slug}`);
    this.name = "AlunoNovidadeAccessDeniedError";
  }
}

export class AlunoNovidadeNotFoundError extends Error {
  constructor(slug: string, novidadeId: string) {
    super(`Novidade não encontrada para slug=${slug} e novidadeId=${novidadeId}. Esperado: novidade publicada do mesmo ambiente.`);
    this.name = "AlunoNovidadeNotFoundError";
  }
}

export async function getAlunoNovidadeDetalhe(
  slug: string,
  novidadeId: string,
  alunoId: string,
): Promise<AlunoNovidadeDetalhe> {
  const [ambiente] = await db
    .select({ id: ambientes.id, slug: ambientes.slug, nome: ambientes.nome })
    .from(ambientes)
    .where(and(eq(ambientes.slug, slug), eq(ambientes.status, "ativo")))
    .limit(1);

  if (!ambiente) {
    throw new AlunoNovidadeAmbienteNotFoundError(slug);
  }

  const [aluno] = await db
    .select({ id: alunos.id, status: alunos.status })
    .from(alunos)
    .where(eq(alunos.id, alunoId))
    .limit(1);

  if (!aluno || aluno.status !== "ativo") {
    throw new AlunoNovidadeAlunoNotFoundError(alunoId);
  }

  const [vinculo] = await db
    .select({ id: ambienteAlunos.id })
    .from(ambienteAlunos)
    .where(
      and(
        eq(ambienteAlunos.ambienteId, ambiente.id),
        eq(ambienteAlunos.alunoId, aluno.id),
        eq(ambienteAlunos.status, "ativo"),
      ),
    )
    .limit(1);

  if (!vinculo) {
    throw new AlunoNovidadeAccessDeniedError(alunoId, slug);
  }

  const [novidade] = await db
    .select({
      id: novidades.id,
      titulo: novidades.titulo,
      resumo: novidades.resumo,
      conteudo: novidades.conteudo,
      imagemUrl: novidades.imagemUrl,
      fonteUrl: novidades.fonteUrl,
      fonteNome: novidades.fonteNome,
      categoria: novidades.categoria,
      publicadoEm: novidades.publicadoEm,
      ambienteId: novidades.ambienteId,
    })
    .from(novidades)
    .where(
      and(
        eq(novidades.status, "publicada"),
        eq(novidades.ambienteId, ambiente.id),
        eq(novidades.id, novidadeId),
      ),
    )
    .limit(1);

  if (!novidade || novidade.ambienteId !== ambiente.id) {
    throw new AlunoNovidadeNotFoundError(slug, novidadeId);
  }

  return {
    id: novidade.id,
    titulo: novidade.titulo,
    resumo: novidade.resumo,
    conteudo: novidade.conteudo,
    imagemUrl: novidade.imagemUrl,
    fonteUrl: novidade.fonteUrl,
    fonteNome: novidade.fonteNome,
    categoria: novidade.categoria,
    publicadoEm: novidade.publicadoEm,
    ambienteSlug: ambiente.slug,
    ambienteNome: ambiente.nome,
  };
}
