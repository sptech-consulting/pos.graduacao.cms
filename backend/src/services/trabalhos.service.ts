import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/connection.js";
import { trabalhos } from "../db/schema/index.js";

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

  return row;
}
