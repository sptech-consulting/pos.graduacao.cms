import { and, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import { ambienteAlunos, ambientes } from "../db/schema/index.js";

// ── Input types ──────────────────────────────────────────────────────────────

export type AmbienteStatus = "ativo" | "inativo" | "rascunho" | "arquivado";

export type CreateAmbienteInput = {
  nome: string;
  slug: string;
  descricao?: string;
  status?: AmbienteStatus;
  corPrimaria?: string;
  corSecundaria?: string;
  corFundo?: string;
  corTexto?: string;
  corBotao?: string;
  corCard?: string;
  corBorda?: string;
  tema?: "claro" | "escuro" | "personalizado";
};

export type UpdateAmbienteInput = Partial<CreateAmbienteInput>;

// ── Domain errors ─────────────────────────────────────────────────────────────

export class SlugConflictError extends Error {
  constructor(slug: string) {
    super(`Slug já em uso: ${slug}`);
    this.name = "SlugConflictError";
  }
}

export class AmbienteNotFoundError extends Error {
  constructor(id: string) {
    super(`Ambiente não encontrado: ${id}`);
    this.name = "AmbienteNotFoundError";
  }
}

export class AmbienteHasActiveMembersError extends Error {
  constructor(id: string) {
    super(`Ambiente possui alunos ativos e não pode ser excluído: ${id}`);
    this.name = "AmbienteHasActiveMembersError";
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Returns true if the slug is already taken by a different ambiente. */
async function slugExists(slug: string, excludeId?: string): Promise<boolean> {
  const rows = await db
    .select({ id: ambientes.id })
    .from(ambientes)
    .where(eq(ambientes.slug, slug))
    .limit(1);

  if (rows.length === 0) return false;
  if (excludeId && rows[0]?.id === excludeId) return false;
  return true;
}

// ── Service functions ─────────────────────────────────────────────────────────

export async function createAmbiente(data: CreateAmbienteInput, adminId: string) {
  const slug = data.slug.toLowerCase().trim();

  if (await slugExists(slug)) throw new SlugConflictError(slug);

  const [created] = await db
    .insert(ambientes)
    .values({ ...data, slug, criadoPor: adminId })
    .$returningId();

  const [ambiente] = await db
    .select()
    .from(ambientes)
    .where(eq(ambientes.id, created!.id))
    .limit(1);

  return ambiente!;
}

export async function listAmbientes() {
  return db.select().from(ambientes).orderBy(ambientes.nome);
}

export async function getAmbienteById(id: string) {
  const [ambiente] = await db.select().from(ambientes).where(eq(ambientes.id, id)).limit(1);

  return ambiente ?? null;
}

export async function updateAmbiente(id: string, data: UpdateAmbienteInput) {
  const existing = await getAmbienteById(id);
  if (!existing) throw new AmbienteNotFoundError(id);

  const patch: UpdateAmbienteInput = { ...data };

  if (patch.slug !== undefined) {
    patch.slug = patch.slug.toLowerCase().trim();
    if (await slugExists(patch.slug, id)) throw new SlugConflictError(patch.slug);
  }

  await db
    .update(ambientes)
    .set({ ...patch, atualizadoEm: new Date() })
    .where(eq(ambientes.id, id));

  return (await getAmbienteById(id))!;
}

export async function updateAmbienteStatus(id: string, status: AmbienteStatus) {
  const existing = await getAmbienteById(id);
  if (!existing) throw new AmbienteNotFoundError(id);

  await db.update(ambientes).set({ status, atualizadoEm: new Date() }).where(eq(ambientes.id, id));
}

export async function deleteAmbiente(id: string) {
  const existing = await getAmbienteById(id);
  if (!existing) throw new AmbienteNotFoundError(id);

  const [activeAluno] = await db
    .select({ id: ambienteAlunos.id })
    .from(ambienteAlunos)
    .where(and(eq(ambienteAlunos.ambienteId, id), eq(ambienteAlunos.status, "ativo")))
    .limit(1);

  if (activeAluno) throw new AmbienteHasActiveMembersError(id);

  await db.delete(ambientes).where(eq(ambientes.id, id));
}
