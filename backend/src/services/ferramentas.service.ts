import { eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  ferramentaBlocos,
  ferramentaCasosTeste,
  ferramentaCasosUso,
  ferramentaFuncionalidades,
  ferramentaTags,
  ferramentas,
} from "../db/schema/index.js";

// ── Input types ───────────────────────────────────────────────────────────────

export type CreateFerramentaInput = {
  nome: string;
  subtitulo?: string;
  descricao?: string;
  descricaoLonga?: string;
  url?: string;
  iconeUrl?: string;
  imagemCapaUrl?: string;
  fraseDestaque?: string;
  categoria?: string;
  tipoAbertura?: "nova_aba" | "mesma_aba" | "modal";
  status?: "ativo" | "inativo";
};

export type UpdateFerramentaInput = Partial<CreateFerramentaInput>;

export type AddCasoUsoInput = { texto: string; ordem?: number };
export type AddTagInput = {
  tipo: "input" | "output" | "integracao";
  rotulo: string;
  ordem?: number;
};
export type AddBlocoInput = { titulo: string; conteudo: string; ordem?: number };
export type AddFuncionalidadeInput = {
  titulo: string;
  descricao?: string;
  imagemUrl?: string;
  ordem?: number;
};
export type AddCasoTesteInput = {
  titulo: string;
  badge?: string;
  promptExemplo?: string;
  explicacao?: string;
  ordem?: number;
};

// ── Domain errors ─────────────────────────────────────────────────────────────

export class FerramentaNotFoundError extends Error {
  constructor(id: string) {
    super(`Ferramenta não encontrada: ${id}`);
    this.name = "FerramentaNotFoundError";
  }
}

export class SubRecursoNotFoundError extends Error {
  constructor(tipo: string, id: string) {
    super(`${tipo} não encontrado: ${id}`);
    this.name = "SubRecursoNotFoundError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

async function assertFerramentaExists(id: string) {
  const [row] = await db
    .select({ id: ferramentas.id })
    .from(ferramentas)
    .where(eq(ferramentas.id, id))
    .limit(1);
  if (!row) throw new FerramentaNotFoundError(id);
}

// ── Ferramentas ───────────────────────────────────────────────────────────────

export async function listFerramentas() {
  return db.select().from(ferramentas).orderBy(ferramentas.nome);
}

export async function createFerramenta(data: CreateFerramentaInput, adminId: string) {
  const [created] = await db
    .insert(ferramentas)
    .values({ ...data, criadoPor: adminId })
    .$returningId();
  const [ferramenta] = await db
    .select()
    .from(ferramentas)
    .where(eq(ferramentas.id, created!.id))
    .limit(1);
  return ferramenta!;
}

export async function getFerramentaById(id: string) {
  const [ferramenta] = await db.select().from(ferramentas).where(eq(ferramentas.id, id)).limit(1);
  if (!ferramenta) return null;

  const casosUso = await db
    .select()
    .from(ferramentaCasosUso)
    .where(eq(ferramentaCasosUso.ferramentaId, id))
    .orderBy(ferramentaCasosUso.ordem);
  const tags = await db
    .select()
    .from(ferramentaTags)
    .where(eq(ferramentaTags.ferramentaId, id))
    .orderBy(ferramentaTags.ordem);
  const blocos = await db
    .select()
    .from(ferramentaBlocos)
    .where(eq(ferramentaBlocos.ferramentaId, id))
    .orderBy(ferramentaBlocos.ordem);
  const funcionalidades = await db
    .select()
    .from(ferramentaFuncionalidades)
    .where(eq(ferramentaFuncionalidades.ferramentaId, id))
    .orderBy(ferramentaFuncionalidades.ordem);
  const casosTeste = await db
    .select()
    .from(ferramentaCasosTeste)
    .where(eq(ferramentaCasosTeste.ferramentaId, id))
    .orderBy(ferramentaCasosTeste.ordem);

  return { ...ferramenta, casosUso, tags, blocos, funcionalidades, casosTeste };
}

export async function updateFerramenta(id: string, data: UpdateFerramentaInput) {
  const [existing] = await db
    .select({ id: ferramentas.id })
    .from(ferramentas)
    .where(eq(ferramentas.id, id))
    .limit(1);
  if (!existing) throw new FerramentaNotFoundError(id);

  await db
    .update(ferramentas)
    .set({ ...data, atualizadoEm: new Date() })
    .where(eq(ferramentas.id, id));
  return (await getFerramentaById(id))!;
}

export async function deleteFerramenta(id: string) {
  const [existing] = await db
    .select({ id: ferramentas.id })
    .from(ferramentas)
    .where(eq(ferramentas.id, id))
    .limit(1);
  if (!existing) throw new FerramentaNotFoundError(id);

  await db.delete(ferramentaCasosUso).where(eq(ferramentaCasosUso.ferramentaId, id));
  await db.delete(ferramentaTags).where(eq(ferramentaTags.ferramentaId, id));
  await db.delete(ferramentaBlocos).where(eq(ferramentaBlocos.ferramentaId, id));
  await db.delete(ferramentaFuncionalidades).where(eq(ferramentaFuncionalidades.ferramentaId, id));
  await db.delete(ferramentaCasosTeste).where(eq(ferramentaCasosTeste.ferramentaId, id));
  await db.delete(ferramentas).where(eq(ferramentas.id, id));
}

// ── Sub-recurso helpers ───────────────────────────────────────────────────────

async function assertSubRecursoOwnership(
  item: { ferramentaId: string } | undefined,
  ferramentaId: string,
  tipo: string,
  itemId: string,
) {
  if (!item || item.ferramentaId !== ferramentaId) throw new SubRecursoNotFoundError(tipo, itemId);
}

// ── Casos de uso ──────────────────────────────────────────────────────────────

export async function addCasoUso(ferramentaId: string, data: AddCasoUsoInput) {
  await assertFerramentaExists(ferramentaId);
  const [created] = await db
    .insert(ferramentaCasosUso)
    .values({ ...data, ferramentaId })
    .$returningId();
  const [item] = await db
    .select()
    .from(ferramentaCasosUso)
    .where(eq(ferramentaCasosUso.id, created!.id))
    .limit(1);
  return item!;
}

export async function removeCasoUso(ferramentaId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(ferramentaCasosUso)
    .where(eq(ferramentaCasosUso.id, itemId))
    .limit(1);
  await assertSubRecursoOwnership(item, ferramentaId, "caso_uso", itemId);
  await db.delete(ferramentaCasosUso).where(eq(ferramentaCasosUso.id, itemId));
}

// ── Tags ──────────────────────────────────────────────────────────────────────

export async function addTag(ferramentaId: string, data: AddTagInput) {
  await assertFerramentaExists(ferramentaId);
  const [created] = await db
    .insert(ferramentaTags)
    .values({ ...data, ferramentaId })
    .$returningId();
  const [item] = await db
    .select()
    .from(ferramentaTags)
    .where(eq(ferramentaTags.id, created!.id))
    .limit(1);
  return item!;
}

export async function removeTag(ferramentaId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(ferramentaTags)
    .where(eq(ferramentaTags.id, itemId))
    .limit(1);
  await assertSubRecursoOwnership(item, ferramentaId, "tag", itemId);
  await db.delete(ferramentaTags).where(eq(ferramentaTags.id, itemId));
}

// ── Blocos ────────────────────────────────────────────────────────────────────

export async function addBloco(ferramentaId: string, data: AddBlocoInput) {
  await assertFerramentaExists(ferramentaId);
  const [created] = await db
    .insert(ferramentaBlocos)
    .values({ ...data, ferramentaId })
    .$returningId();
  const [item] = await db
    .select()
    .from(ferramentaBlocos)
    .where(eq(ferramentaBlocos.id, created!.id))
    .limit(1);
  return item!;
}

export async function removeBloco(ferramentaId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(ferramentaBlocos)
    .where(eq(ferramentaBlocos.id, itemId))
    .limit(1);
  await assertSubRecursoOwnership(item, ferramentaId, "bloco", itemId);
  await db.delete(ferramentaBlocos).where(eq(ferramentaBlocos.id, itemId));
}

// ── Funcionalidades ───────────────────────────────────────────────────────────

export async function addFuncionalidade(ferramentaId: string, data: AddFuncionalidadeInput) {
  await assertFerramentaExists(ferramentaId);
  const [created] = await db
    .insert(ferramentaFuncionalidades)
    .values({ ...data, ferramentaId })
    .$returningId();
  const [item] = await db
    .select()
    .from(ferramentaFuncionalidades)
    .where(eq(ferramentaFuncionalidades.id, created!.id))
    .limit(1);
  return item!;
}

export async function removeFuncionalidade(ferramentaId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(ferramentaFuncionalidades)
    .where(eq(ferramentaFuncionalidades.id, itemId))
    .limit(1);
  await assertSubRecursoOwnership(item, ferramentaId, "funcionalidade", itemId);
  await db.delete(ferramentaFuncionalidades).where(eq(ferramentaFuncionalidades.id, itemId));
}

// ── Casos de teste ────────────────────────────────────────────────────────────

export async function addCasoTeste(ferramentaId: string, data: AddCasoTesteInput) {
  await assertFerramentaExists(ferramentaId);
  const [created] = await db
    .insert(ferramentaCasosTeste)
    .values({ ...data, ferramentaId })
    .$returningId();
  const [item] = await db
    .select()
    .from(ferramentaCasosTeste)
    .where(eq(ferramentaCasosTeste.id, created!.id))
    .limit(1);
  return item!;
}

export async function removeCasoTeste(ferramentaId: string, itemId: string) {
  const [item] = await db
    .select()
    .from(ferramentaCasosTeste)
    .where(eq(ferramentaCasosTeste.id, itemId))
    .limit(1);
  await assertSubRecursoOwnership(item, ferramentaId, "caso_teste", itemId);
  await db.delete(ferramentaCasosTeste).where(eq(ferramentaCasosTeste.id, itemId));
}
