import { and, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  ambienteAlunos,
  ambienteFerramentas,
  ambientes,
  alunos,
  ferramentaBlocos,
  ferramentaCasosTeste,
  ferramentaCasosUso,
  ferramentaFuncionalidades,
  ferramentaTags,
  ferramentas,
} from "../db/schema/index.js";

export type AlunoFerramentaTagTipo = "input" | "output" | "integracao";

export type AlunoFerramentaDetalhe = {
  id: string;
  nome: string;
  descricao: string | null;
  subtitulo: string | null;
  descricaoLonga: string | null;
  url: string | null;
  iconeUrl: string | null;
  imagemCapaUrl: string | null;
  categoria: string | null;
  tipoAbertura: "nova_aba" | "mesma_aba" | "modal" | null;
  fraseDestaque: string | null;
  casosUso: Array<{ id: string; texto: string }>;
  tags: Array<{ id: string; tipo: AlunoFerramentaTagTipo; rotulo: string }>;
  blocos: Array<{ id: string; titulo: string; conteudo: string }>;
  funcionalidades: Array<{ id: string; titulo: string; descricao: string | null; imagemUrl: string | null }>;
  casosTeste: Array<{ id: string; titulo: string; badge: string | null; promptExemplo: string | null; explicacao: string | null }>;
  ambienteSlug: string;
  ambienteNome: string;
};

export class AlunoFerramentaAmbienteNotFoundError extends Error {
  constructor(slug: string) {
    super(`Ambiente não encontrado ou inativo: ${slug}`);
    this.name = "AlunoFerramentaAmbienteNotFoundError";
  }
}

export class AlunoFerramentaAlunoNotFoundError extends Error {
  constructor(alunoId: string) {
    super(`Aluno não cadastrado ou inativo: ${alunoId}`);
    this.name = "AlunoFerramentaAlunoNotFoundError";
  }
}

export class AlunoFerramentaAccessDeniedError extends Error {
  constructor(alunoId: string, slug: string) {
    super(`Aluno ${alunoId} sem acesso a este ambiente: ${slug}`);
    this.name = "AlunoFerramentaAccessDeniedError";
  }
}

export class AlunoFerramentaNotFoundError extends Error {
  constructor(slug: string, ferramentaId: string) {
    super(`Ferramenta não encontrada para slug=${slug} e ferramentaId=${ferramentaId}. Esperado: ferramenta ativa e vinculada ao ambiente.`);
    this.name = "AlunoFerramentaNotFoundError";
  }
}

export async function getAlunoFerramentaDetalhe(
  slug: string,
  ferramentaId: string,
  alunoId: string,
): Promise<AlunoFerramentaDetalhe> {
  const [ambiente] = await db
    .select({ id: ambientes.id, slug: ambientes.slug, nome: ambientes.nome })
    .from(ambientes)
    .where(and(eq(ambientes.slug, slug), eq(ambientes.status, "ativo")))
    .limit(1);

  if (!ambiente) {
    throw new AlunoFerramentaAmbienteNotFoundError(slug);
  }

  const [aluno] = await db
    .select({ id: alunos.id, status: alunos.status })
    .from(alunos)
    .where(eq(alunos.id, alunoId))
    .limit(1);

  if (!aluno || aluno.status !== "ativo") {
    throw new AlunoFerramentaAlunoNotFoundError(alunoId);
  }

  const [vinculoAluno] = await db
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

  if (!vinculoAluno) {
    throw new AlunoFerramentaAccessDeniedError(alunoId, slug);
  }

  const [ferramenta] = await db
    .select({
      id: ferramentas.id,
      nome: ferramentas.nome,
      descricao: ferramentas.descricao,
      subtitulo: ferramentas.subtitulo,
      descricaoLonga: ferramentas.descricaoLonga,
      url: ferramentas.url,
      iconeUrl: ferramentas.iconeUrl,
      imagemCapaUrl: ferramentas.imagemCapaUrl,
      categoria: ferramentas.categoria,
      tipoAbertura: ferramentas.tipoAbertura,
      fraseDestaque: ferramentas.fraseDestaque,
      status: ferramentas.status,
    })
    .from(ferramentas)
    .where(eq(ferramentas.id, ferramentaId))
    .limit(1);

  if (!ferramenta || ferramenta.status !== "ativo") {
    throw new AlunoFerramentaNotFoundError(slug, ferramentaId);
  }

  const [vinculoFerramenta] = await db
    .select({ id: ambienteFerramentas.id })
    .from(ambienteFerramentas)
    .where(
      and(
        eq(ambienteFerramentas.ambienteId, ambiente.id),
        eq(ambienteFerramentas.ferramentaId, ferramenta.id),
        eq(ambienteFerramentas.status, "ativo"),
      ),
    )
    .limit(1);

  if (!vinculoFerramenta) {
    throw new AlunoFerramentaNotFoundError(slug, ferramentaId);
  }

  const [casosUsoRows, tagsRows, blocosRows, funcionalidadesRows, casosTesteRows] = await Promise.all([
    db.select({ id: ferramentaCasosUso.id, texto: ferramentaCasosUso.texto }).from(ferramentaCasosUso).where(eq(ferramentaCasosUso.ferramentaId, ferramenta.id)).orderBy(ferramentaCasosUso.ordem),
    db.select({ id: ferramentaTags.id, tipo: ferramentaTags.tipo, rotulo: ferramentaTags.rotulo }).from(ferramentaTags).where(eq(ferramentaTags.ferramentaId, ferramenta.id)).orderBy(ferramentaTags.ordem),
    db.select({ id: ferramentaBlocos.id, titulo: ferramentaBlocos.titulo, conteudo: ferramentaBlocos.conteudo }).from(ferramentaBlocos).where(eq(ferramentaBlocos.ferramentaId, ferramenta.id)).orderBy(ferramentaBlocos.ordem),
    db.select({ id: ferramentaFuncionalidades.id, titulo: ferramentaFuncionalidades.titulo, descricao: ferramentaFuncionalidades.descricao, imagemUrl: ferramentaFuncionalidades.imagemUrl }).from(ferramentaFuncionalidades).where(eq(ferramentaFuncionalidades.ferramentaId, ferramenta.id)).orderBy(ferramentaFuncionalidades.ordem),
    db.select({ id: ferramentaCasosTeste.id, titulo: ferramentaCasosTeste.titulo, badge: ferramentaCasosTeste.badge, promptExemplo: ferramentaCasosTeste.promptExemplo, explicacao: ferramentaCasosTeste.explicacao }).from(ferramentaCasosTeste).where(eq(ferramentaCasosTeste.ferramentaId, ferramenta.id)).orderBy(ferramentaCasosTeste.ordem),
  ]);

  return {
    id: ferramenta.id,
    nome: ferramenta.nome,
    descricao: ferramenta.descricao,
    subtitulo: ferramenta.subtitulo,
    descricaoLonga: ferramenta.descricaoLonga,
    url: ferramenta.url,
    iconeUrl: ferramenta.iconeUrl,
    imagemCapaUrl: ferramenta.imagemCapaUrl,
    categoria: ferramenta.categoria,
    tipoAbertura: ferramenta.tipoAbertura,
    fraseDestaque: ferramenta.fraseDestaque,
    casosUso: casosUsoRows,
    tags: tagsRows.map((item) => ({
      id: item.id,
      tipo: item.tipo as AlunoFerramentaTagTipo,
      rotulo: item.rotulo,
    })),
    blocos: blocosRows,
    funcionalidades: funcionalidadesRows,
    casosTeste: casosTesteRows,
    ambienteSlug: ambiente.slug,
    ambienteNome: ambiente.nome,
  };
}
