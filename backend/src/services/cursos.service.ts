import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { aulas, cursos, modulos } from "../db/schema/index.js";

// ── Input types ───────────────────────────────────────────────────────────────

export type CursoStatus = "rascunho" | "publicada" | "arquivada";
export type ModuloStatus = "ativo" | "inativo";
export type TipoConteudo = "video" | "texto" | "pdf" | "link" | "misto";
export type AulaStatus = "rascunho" | "publicada" | "arquivada";

export type CreateCursoInput = {
  titulo: string;
  descricao?: string;
  capaUrl?: string;
  categoria?: string;
  cargaHorariaMinutos?: number;
  nivel?: string;
  status?: CursoStatus;
};

export type UpdateCursoInput = Partial<CreateCursoInput>;

export type CreateModuloInput = {
  titulo: string;
  descricao?: string;
  ordem?: number;
  status?: ModuloStatus;
};

export type UpdateModuloInput = Partial<CreateModuloInput>;

export type CreateAulaInput = {
  titulo: string;
  descricao?: string;
  videoUrl?: string;
  materialUrl?: string;
  thumbnailUrl?: string;
  duracaoMinutos?: number;
  tipoConteudo?: TipoConteudo;
  status?: AulaStatus;
  ordem?: number;
};

export type UpdateAulaInput = Partial<CreateAulaInput>;

// ── Domain errors ─────────────────────────────────────────────────────────────

export class CursoNotFoundError extends Error {
  constructor(id: string) {
    super(`Curso não encontrado: ${id}`);
    this.name = "CursoNotFoundError";
  }
}

export class ModuloNotFoundError extends Error {
  constructor(id: string) {
    super(`Módulo não encontrado: ${id}`);
    this.name = "ModuloNotFoundError";
  }
}

export class AulaNotFoundError extends Error {
  constructor(id: string) {
    super(`Aula não encontrada: ${id}`);
    this.name = "AulaNotFoundError";
  }
}

export class CursoHasModulosError extends Error {
  constructor(id: string) {
    super(`Curso possui módulos e não pode ser excluído: ${id}`);
    this.name = "CursoHasModulosError";
  }
}

export class ModuloHasAulasError extends Error {
  constructor(id: string) {
    super(`Módulo possui aulas e não pode ser excluído: ${id}`);
    this.name = "ModuloHasAulasError";
  }
}

// ── Cursos ────────────────────────────────────────────────────────────────────

export async function createCurso(data: CreateCursoInput, adminId: string) {
  const [created] = await db
    .insert(cursos)
    .values({ ...data, criadoPor: adminId })
    .$returningId();

  const [curso] = await db.select().from(cursos).where(eq(cursos.id, created!.id)).limit(1);

  return curso!;
}

export async function listCursos() {
  return db.select().from(cursos).orderBy(cursos.titulo);
}

export async function getCursoById(id: string) {
  const [curso] = await db.select().from(cursos).where(eq(cursos.id, id)).limit(1);
  return curso ?? null;
}

export async function updateCurso(id: string, data: UpdateCursoInput) {
  const existing = await getCursoById(id);
  if (!existing) throw new CursoNotFoundError(id);

  await db
    .update(cursos)
    .set({ ...data, atualizadoEm: new Date() })
    .where(eq(cursos.id, id));
  return (await getCursoById(id))!;
}

export async function deleteCurso(id: string) {
  const existing = await getCursoById(id);
  if (!existing) throw new CursoNotFoundError(id);

  const [hasModulo] = await db
    .select({ id: modulos.id })
    .from(modulos)
    .where(eq(modulos.cursoId, id))
    .limit(1);

  if (hasModulo) throw new CursoHasModulosError(id);

  await db.delete(cursos).where(eq(cursos.id, id));
}

// ── Módulos ───────────────────────────────────────────────────────────────────

export async function createModulo(cursoId: string, data: CreateModuloInput) {
  const curso = await getCursoById(cursoId);
  if (!curso) throw new CursoNotFoundError(cursoId);

  const [created] = await db
    .insert(modulos)
    .values({ ...data, cursoId })
    .$returningId();

  const [modulo] = await db.select().from(modulos).where(eq(modulos.id, created!.id)).limit(1);

  return modulo!;
}

export async function listModulosByCurso(cursoId: string) {
  return db.select().from(modulos).where(eq(modulos.cursoId, cursoId)).orderBy(modulos.ordem);
}

export async function getModuloById(id: string) {
  const [modulo] = await db.select().from(modulos).where(eq(modulos.id, id)).limit(1);
  return modulo ?? null;
}

export async function updateModulo(id: string, data: UpdateModuloInput) {
  const existing = await getModuloById(id);
  if (!existing) throw new ModuloNotFoundError(id);

  await db
    .update(modulos)
    .set({ ...data, atualizadoEm: new Date() })
    .where(eq(modulos.id, id));
  return (await getModuloById(id))!;
}

export async function deleteModulo(id: string) {
  const existing = await getModuloById(id);
  if (!existing) throw new ModuloNotFoundError(id);

  const [hasAula] = await db
    .select({ id: aulas.id })
    .from(aulas)
    .where(eq(aulas.moduloId, id))
    .limit(1);

  if (hasAula) throw new ModuloHasAulasError(id);

  await db.delete(modulos).where(eq(modulos.id, id));
}

// ── Aulas ─────────────────────────────────────────────────────────────────────

export async function createAula(moduloId: string, data: CreateAulaInput, adminId: string) {
  const modulo = await getModuloById(moduloId);
  if (!modulo) throw new ModuloNotFoundError(moduloId);

  const [created] = await db
    .insert(aulas)
    .values({ ...data, moduloId, criadoPor: adminId })
    .$returningId();

  const [aula] = await db.select().from(aulas).where(eq(aulas.id, created!.id)).limit(1);

  return aula!;
}

export async function listAulasByModulo(moduloId: string) {
  return db.select().from(aulas).where(eq(aulas.moduloId, moduloId)).orderBy(aulas.ordem);
}

export async function getAulaById(id: string) {
  const [aula] = await db.select().from(aulas).where(eq(aulas.id, id)).limit(1);
  return aula ?? null;
}

export async function updateAula(id: string, data: UpdateAulaInput) {
  const existing = await getAulaById(id);
  if (!existing) throw new AulaNotFoundError(id);

  await db
    .update(aulas)
    .set({ ...data, atualizadoEm: new Date() })
    .where(eq(aulas.id, id));
  return (await getAulaById(id))!;
}

export async function deleteAula(id: string) {
  const existing = await getAulaById(id);
  if (!existing) throw new AulaNotFoundError(id);

  await db.delete(aulas).where(eq(aulas.id, id));
}
