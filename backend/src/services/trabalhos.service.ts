import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  ambientes,
  trabalhoFuncionalidades,
  trabalhoLinks,
  trabalhos,
} from "../db/schema/index.js";

// ── Input types ───────────────────────────────────────────────────────────────

export type TrabalhoStatus = "rascunho" | "publicada" | "arquivada";
export type ApresentacaoTipo = "video" | "pptx" | "imagem" | "documento" | "link";

export type CreateTrabalhoInput = {
  titulo: string;
  autorNome: string;
  subtitulo?: string;
  resumo?: string;
  conteudo?: string;
  turma?: string;
  imagemCapaUrl?: string;
  linkExterno?: string;
  tags?: string[];
  status?: TrabalhoStatus;
  destaque?: boolean;
  ordem?: number;
  publicadoEm?: Date;
  apresentacaoTipo?: ApresentacaoTipo;
  apresentacaoUrl?: string;
  apresentacaoTitulo?: string;
  apresentacaoDescricao?: string;
  apresentacaoImagemUrl?: string;
  aplicacaoExpectativa?: string;
};

export type UpdateTrabalhoInput = Partial<CreateTrabalhoInput>;

// ── Domain errors ─────────────────────────────────────────────────────────────

export class TrabalhoNotFoundError extends Error {
  constructor(id: string) {
    super(`Trabalho não encontrado: ${id}`);
    this.name = "TrabalhoNotFoundError";
  }
}

export class TrabalhoAmbienteMismatchError extends Error {
  constructor(id: string, ambienteId: string) {
    super(`Trabalho ${id} não pertence ao ambiente ${ambienteId}`);
    this.name = "TrabalhoAmbienteMismatchError";
  }
}

export class AmbienteCodigoNotFoundError extends Error {
  constructor(codigo: string) {
    super(`Código não encontrado: ${codigo}`);
    this.name = "AmbienteCodigoNotFoundError";
  }
}

export type AmbientePublico = {
  ambienteId: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
  corFundo: string | null;
  corTexto: string | null;
};

export type TrabalhoPublicoDetalhado = Awaited<ReturnType<typeof getTrabalhoPublico>>;

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertTrabalhoExists(trabalhoId: string) {
  const [row] = await db
    .select({ id: trabalhos.id, ambienteId: trabalhos.ambienteId })
    .from(trabalhos)
    .where(eq(trabalhos.id, trabalhoId))
    .limit(1);
  if (!row) throw new TrabalhoNotFoundError(trabalhoId);
  return row;
}

async function assertTrabalhoInAmbiente(ambienteId: string, trabalhoId: string) {
  const [row] = await db
    .select({ id: trabalhos.id })
    .from(trabalhos)
    .where(and(eq(trabalhos.id, trabalhoId), eq(trabalhos.ambienteId, ambienteId)))
    .limit(1);
  if (!row) throw new TrabalhoNotFoundError(trabalhoId);
  return row;
}

function normalizeCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/\s+/g, "");
}

// ── Admin queries ─────────────────────────────────────────────────────────────

export async function listTrabalhos(ambienteId: string) {
  return db
    .select()
    .from(trabalhos)
    .where(eq(trabalhos.ambienteId, ambienteId))
    .orderBy(trabalhos.ordem, trabalhos.criadoEm);
}

export async function getTrabalhoById(trabalhoId: string) {
  const [row] = await db
    .select()
    .from(trabalhos)
    .where(eq(trabalhos.id, trabalhoId))
    .limit(1);
  if (!row) throw new TrabalhoNotFoundError(trabalhoId);
  return row;
}

export async function createTrabalho(ambienteId: string, data: CreateTrabalhoInput) {
  const [created] = await db
    .insert(trabalhos)
    .values({ ...data, ambienteId })
    .$returningId();
  return getTrabalhoById(created!.id);
}

export async function updateTrabalho(trabalhoId: string, data: UpdateTrabalhoInput) {
  await assertTrabalhoExists(trabalhoId);
  await db
    .update(trabalhos)
    .set({ ...data, atualizadoEm: new Date() })
    .where(eq(trabalhos.id, trabalhoId));
  return getTrabalhoById(trabalhoId);
}

export async function deleteTrabalho(ambienteId: string, trabalhoId: string) {
  await assertTrabalhoInAmbiente(ambienteId, trabalhoId);
  await db.delete(trabalhos).where(eq(trabalhos.id, trabalhoId));
}

// ── Public queries ────────────────────────────────────────────────────────────

export async function listTrabalhosPublicos(ambienteId: string) {
  return db
    .select()
    .from(trabalhos)
    .where(and(eq(trabalhos.ambienteId, ambienteId), eq(trabalhos.status, "publicada")))
    .orderBy(trabalhos.destaque, trabalhos.ordem, trabalhos.publicadoEm);
}

export async function getTrabalhoPublico(ambienteId: string, trabalhoId: string) {
  const [row] = await db
    .select()
    .from(trabalhos)
    .where(
      and(
        eq(trabalhos.id, trabalhoId),
        eq(trabalhos.ambienteId, ambienteId),
        eq(trabalhos.status, "publicada"),
      ),
    )
    .limit(1);
  if (!row) throw new TrabalhoNotFoundError(trabalhoId);

  // increment view count asynchronously — fire-and-forget
  await db
    .update(trabalhos)
    .set({ visualizacoes: sql`${trabalhos.visualizacoes} + 1` })
    .where(eq(trabalhos.id, trabalhoId));

  const funcionalidades = await db
    .select({
      id: trabalhoFuncionalidades.id,
      ordem: trabalhoFuncionalidades.ordem,
      titulo: trabalhoFuncionalidades.titulo,
      descricao: trabalhoFuncionalidades.descricao,
      imagemUrl: trabalhoFuncionalidades.imagemUrl,
    })
    .from(trabalhoFuncionalidades)
    .where(eq(trabalhoFuncionalidades.trabalhoId, trabalhoId))
    .orderBy(trabalhoFuncionalidades.ordem, trabalhoFuncionalidades.criadoEm);

  const links = await db
    .select({
      id: trabalhoLinks.id,
      ordem: trabalhoLinks.ordem,
      rotulo: trabalhoLinks.rotulo,
      url: trabalhoLinks.url,
      iconeUrl: trabalhoLinks.iconeUrl,
    })
    .from(trabalhoLinks)
    .where(eq(trabalhoLinks.trabalhoId, trabalhoId))
    .orderBy(trabalhoLinks.ordem, trabalhoLinks.criadoEm);

  const [ambiente] = await db
    .select({
      nome: ambientes.nome,
      slug: ambientes.slug,
    })
    .from(ambientes)
    .where(eq(ambientes.id, ambienteId))
    .limit(1);

  return {
    ...row,
    ambienteNome: ambiente?.nome ?? "",
    ambienteSlug: ambiente?.slug ?? "",
    funcionalidades,
    links,
  };
}

export async function resolveAmbientePublicoPorCodigo(codigo: string): Promise<AmbientePublico> {
  const codigoNormalizado = normalizeCodigo(codigo);

  const [ambiente] = await db
    .select({
      ambienteId: ambientes.id,
      nome: ambientes.nome,
      slug: ambientes.slug,
      logoUrl: ambientes.logoUrl,
      corPrimaria: ambientes.corPrimaria,
      corSecundaria: ambientes.corSecundaria,
      corFundo: ambientes.corFundo,
      corTexto: ambientes.corTexto,
    })
    .from(ambientes)
    .where(eq(ambientes.codigoAcessoResultados, codigoNormalizado))
    .limit(1);

  if (!ambiente) {
    throw new AmbienteCodigoNotFoundError(codigoNormalizado);
  }

  return ambiente;
}
