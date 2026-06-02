import { and, eq } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  alunos,
  ambienteAlunos,
  importacoesAlunos,
  importacoesAlunosErros,
} from "../db/schema/index.js";

// ── Input types ───────────────────────────────────────────────────────────────

export type AlunoStatus = "ativo" | "inativo" | "bloqueado";

export type CreateAlunoInput = {
  nomeCompleto: string;
  emailAcesso: string;
  whatsapp?: string;
};

export type UpdateAlunoInput = {
  nomeCompleto?: string;
  emailAcesso?: string;
  whatsapp?: string;
};

export type ImportRow = {
  nomeCompleto: string;
  emailAcesso: string;
  whatsapp?: string;
};

// ── Domain errors ─────────────────────────────────────────────────────────────

export class AlunoNotFoundError extends Error {
  constructor(id: string) {
    super(`Aluno não encontrado: ${id}`);
    this.name = "AlunoNotFoundError";
  }
}

export class AlunoNaoVinculadoError extends Error {
  constructor(ambienteId: string, alunoId: string) {
    super(`Aluno ${alunoId} não está vinculado ao ambiente ${ambienteId}`);
    this.name = "AlunoNaoVinculadoError";
  }
}

export class AlunoJaVinculadoError extends Error {
  constructor(ambienteId: string, alunoId: string) {
    super(`Aluno ${alunoId} já está vinculado ao ambiente ${ambienteId}`);
    this.name = "AlunoJaVinculadoError";
  }
}

export class EmailDuplicadoError extends Error {
  constructor(email: string) {
    super(`Email já cadastrado: ${email}`);
    this.name = "EmailDuplicadoError";
  }
}

export class ImportacaoNotFoundError extends Error {
  constructor(id: string) {
    super(`Importação não encontrada: ${id}`);
    this.name = "ImportacaoNotFoundError";
  }
}

// ── Selected columns (never expose senhaHash) ─────────────────────────────────

const alunosCols = {
  id: alunos.id,
  nomeCompleto: alunos.nomeCompleto,
  emailAcesso: alunos.emailAcesso,
  whatsapp: alunos.whatsapp,
  status: alunos.status,
  criadoEm: alunos.criadoEm,
  atualizadoEm: alunos.atualizadoEm,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

async function findVinculo(ambienteId: string, alunoId: string) {
  const [row] = await db
    .select({ id: ambienteAlunos.id, status: ambienteAlunos.status })
    .from(ambienteAlunos)
    .where(and(eq(ambienteAlunos.ambienteId, ambienteId), eq(ambienteAlunos.alunoId, alunoId)))
    .limit(1);
  return row ?? null;
}

async function assertVinculo(ambienteId: string, alunoId: string) {
  const vinculo = await findVinculo(ambienteId, alunoId);
  if (!vinculo) throw new AlunoNaoVinculadoError(ambienteId, alunoId);
  return vinculo;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Alunos CRUD ───────────────────────────────────────────────────────────────

export async function listAlunosDoAmbiente(ambienteId: string) {
  return db
    .select({ ...alunosCols, vinculoStatus: ambienteAlunos.status })
    .from(ambienteAlunos)
    .innerJoin(alunos, eq(alunos.id, ambienteAlunos.alunoId))
    .where(eq(ambienteAlunos.ambienteId, ambienteId))
    .orderBy(alunos.nomeCompleto);
}

export async function createAluno(ambienteId: string, data: CreateAlunoInput) {
  // Upsert by email — find existing aluno first
  const [existing] = await db
    .select(alunosCols)
    .from(alunos)
    .where(eq(alunos.emailAcesso, data.emailAcesso))
    .limit(1);

  const alunoId = existing
    ? existing.id
    : await (async () => {
        const [created] = await db
          .insert(alunos)
          .values({
            nomeCompleto: data.nomeCompleto,
            emailAcesso: data.emailAcesso,
            whatsapp: data.whatsapp,
          })
          .$returningId();
        return created!.id;
      })();

  // Check if already linked
  const linked = await findVinculo(ambienteId, alunoId);
  if (linked) throw new AlunoJaVinculadoError(ambienteId, alunoId);

  await db.insert(ambienteAlunos).values({ ambienteId, alunoId, status: "ativo" });

  const [aluno] = await db.select(alunosCols).from(alunos).where(eq(alunos.id, alunoId)).limit(1);
  return aluno!;
}

export async function getAlunoDoAmbiente(ambienteId: string, alunoId: string) {
  const [aluno] = await db.select(alunosCols).from(alunos).where(eq(alunos.id, alunoId)).limit(1);
  if (!aluno) throw new AlunoNotFoundError(alunoId);

  const vinculo = await findVinculo(ambienteId, alunoId);
  if (!vinculo) throw new AlunoNaoVinculadoError(ambienteId, alunoId);

  return aluno;
}

export async function updateAluno(ambienteId: string, alunoId: string, data: UpdateAlunoInput) {
  await assertVinculo(ambienteId, alunoId);

  if (data.emailAcesso !== undefined) {
    const [conflict] = await db
      .select({ id: alunos.id })
      .from(alunos)
      .where(eq(alunos.emailAcesso, data.emailAcesso))
      .limit(1);
    if (conflict && conflict.id !== alunoId) throw new EmailDuplicadoError(data.emailAcesso);
  }

  await db
    .update(alunos)
    .set({ ...data, atualizadoEm: new Date() })
    .where(eq(alunos.id, alunoId));

  const [updated] = await db.select(alunosCols).from(alunos).where(eq(alunos.id, alunoId)).limit(1);
  return updated!;
}

export async function updateAlunoStatus(ambienteId: string, alunoId: string, status: AlunoStatus) {
  await assertVinculo(ambienteId, alunoId);
  await db.update(alunos).set({ status, atualizadoEm: new Date() }).where(eq(alunos.id, alunoId));
}

export async function desvincularAluno(ambienteId: string, alunoId: string) {
  await assertVinculo(ambienteId, alunoId);
  await db
    .update(ambienteAlunos)
    .set({ status: "inativo", atualizadoEm: new Date() })
    .where(and(eq(ambienteAlunos.ambienteId, ambienteId), eq(ambienteAlunos.alunoId, alunoId)));
}

// ── Importação em lote ────────────────────────────────────────────────────────

export async function importarAlunos(ambienteId: string, rows: ImportRow[], adminId: string) {
  const [created] = await db
    .insert(importacoesAlunos)
    .values({ ambienteId, totalLinhas: rows.length, status: "processando", criadoPor: adminId })
    .$returningId();
  const importacaoId = created!.id;

  let totalImportados = 0;
  let totalAtualizados = 0;
  let totalErros = 0;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;

    if (!isValidEmail(row.emailAcesso)) {
      await db
        .insert(importacoesAlunosErros)
        .values({
          importacaoId,
          numeroLinha: i + 1,
          nomeCompleto: row.nomeCompleto,
          emailAcesso: row.emailAcesso,
          erro: `Email inválido: ${row.emailAcesso}`,
        })
        .$returningId();
      totalErros++;
      continue;
    }

    try {
      const [existing] = await db
        .select({ id: alunos.id })
        .from(alunos)
        .where(eq(alunos.emailAcesso, row.emailAcesso))
        .limit(1);

      const alunoId = existing
        ? existing.id
        : await (async () => {
            const [ins] = await db
              .insert(alunos)
              .values({
                nomeCompleto: row.nomeCompleto,
                emailAcesso: row.emailAcesso,
                whatsapp: row.whatsapp,
              })
              .$returningId();
            return ins!.id;
          })();

      const linked = await findVinculo(ambienteId, alunoId);
      if (!linked) {
        await db
          .insert(ambienteAlunos)
          .values({ ambienteId, alunoId, status: "ativo", importacaoId });
        totalImportados++;
      } else {
        totalAtualizados++;
      }
    } catch {
      await db
        .insert(importacoesAlunosErros)
        .values({
          importacaoId,
          numeroLinha: i + 1,
          nomeCompleto: row.nomeCompleto,
          emailAcesso: row.emailAcesso,
          erro: "Erro ao processar linha",
        })
        .$returningId();
      totalErros++;
    }
  }

  await db
    .update(importacoesAlunos)
    .set({
      totalImportados,
      totalAtualizados,
      totalErros,
      status: totalErros === rows.length ? "com_erros" : "concluida",
      finalizadoEm: new Date(),
    })
    .where(eq(importacoesAlunos.id, importacaoId));

  const [importacao] = await db
    .select()
    .from(importacoesAlunos)
    .where(eq(importacoesAlunos.id, importacaoId))
    .limit(1);

  return importacao!;
}

export async function listImportacoes(ambienteId: string) {
  return db
    .select()
    .from(importacoesAlunos)
    .where(eq(importacoesAlunos.ambienteId, ambienteId))
    .orderBy(importacoesAlunos.criadoEm);
}

export async function getImportacaoById(id: string) {
  const [importacao] = await db
    .select()
    .from(importacoesAlunos)
    .where(eq(importacoesAlunos.id, id))
    .limit(1);
  return importacao ?? null;
}

export async function listImportacaoErros(importacaoId: string) {
  const importacao = await getImportacaoById(importacaoId);
  if (!importacao) throw new ImportacaoNotFoundError(importacaoId);

  return db
    .select()
    .from(importacoesAlunosErros)
    .where(eq(importacoesAlunosErros.importacaoId, importacaoId))
    .orderBy(importacoesAlunosErros.numeroLinha);
}
