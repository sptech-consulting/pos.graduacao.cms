import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[][] = [];
const insertIds: string[] = [];
let deleted = false;
let updated = false;
let duplicateUpdated = false;

function dequeue() {
  return selectQueue.shift() ?? [];
}

function whereResult() {
  return {
    limit: async () => dequeue(),
    orderBy: async () => dequeue(),
    then: (resolve: (value: unknown[]) => unknown) => resolve(dequeue()),
  };
}

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => whereResult(),
        orderBy: async () => dequeue(),
      }),
    }),
    insert: () => ({
      values: () => ({
        $returningId: async () => [{ id: insertIds.shift() ?? "new-id" }],
        onDuplicateKeyUpdate: async () => {
          duplicateUpdated = true;
        },
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          updated = true;
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        deleted = true;
      },
    }),
  },
}));

import {
  AlunoAulaAccessDeniedError,
  AlunoAulaAlunoNotFoundError,
  AlunoAulaAmbienteNotFoundError,
  AlunoAulaComentarioForbiddenError,
  AlunoAulaComentarioNotFoundError,
  AlunoAulaComentarioRateLimitError,
  AlunoAulaNotFoundError,
  createAlunoAulaComentario,
  getAlunoAulaPlayer,
  removeAlunoAulaComentario,
  saveAlunoAulaProgresso,
  setAlunoAulaConclusao,
  toggleAlunoAulaComentarioCurtida,
} from "./aluno-aula-player.service.js";

const AULA = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ALUNO = "b2c3d4e5-f6a7-8901-bcde-f01234567891";
const CURSO = "c3d4e5f6-a7b8-9012-cdef-0123456789ab";
const MODULO = "d4e5f6a7-b8c9-0123-def0-123456789abc";
const AMBIENTE = "e5f6a7b8-c9d0-1234-ef01-23456789abcd";
const COMENTARIO = "f6a7b8c9-d0e1-2345-f012-3456789abcde";

function queueAcesso() {
  selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA", logoUrl: null, corPrimaria: null, corSecundaria: null, corFundo: null, corTexto: null, corBotao: null, corCard: null, corBorda: null, tema: "claro" }]);
  selectQueue.push([{ id: ALUNO, nomeCompleto: "Aluno", status: "ativo" }]);
  selectQueue.push([{ id: "vinc" }]);
  selectQueue.push([{ id: AULA, titulo: "Aula", descricao: null, videoUrl: null, materialUrl: null, duracaoMinutos: 10, tipoConteudo: "video", moduloId: MODULO, ordem: 1, status: "publicada" }]);
  selectQueue.push([{ id: MODULO, titulo: "Modulo", ordem: 1, cursoId: CURSO }]);
  selectQueue.push([{ id: "curso-vinc" }]);
}

function reset() {
  selectQueue.length = 0;
  insertIds.length = 0;
  deleted = false;
  updated = false;
  duplicateUpdated = false;
}

describe("aluno-aula-player.service", () => {
  beforeEach(reset);

  it("loads player payload", async () => {
    queueAcesso();
    selectQueue.push([{ id: CURSO, titulo: "Curso" }]);
    selectQueue.push([{ id: MODULO, titulo: "Modulo", ordem: 1 }]);
    selectQueue.push([{ id: AULA, titulo: "Aula", ordem: 1, duracaoMinutos: 10, moduloId: MODULO }]);
    selectQueue.push([{ aulaId: AULA, concluida: "1", segundosAssistidos: 120 }]);
    selectQueue.push([]);
    selectQueue.push([]);
    selectQueue.push([]);
    selectQueue.push([]);
    selectQueue.push([]);
    selectQueue.push([]);
    selectQueue.push([]);
    selectQueue.push([]);

    const result = await getAlunoAulaPlayer("ia", AULA, ALUNO);

    expect(result.aula.id).toBe(AULA);
    expect(result.aula.concluida).toBe(true);
    expect(result.aula.segundosAssistidos).toBe(120);
  });

  it("throws when ambiente is missing", async () => {
    selectQueue.push([]);
    await expect(getAlunoAulaPlayer("ia", AULA, ALUNO)).rejects.toBeInstanceOf(AlunoAulaAmbienteNotFoundError);
  });

  it("throws when aluno is inactive", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA", logoUrl: null, corPrimaria: null, corSecundaria: null, corFundo: null, corTexto: null, corBotao: null, corCard: null, corBorda: null, tema: "claro" }]);
    selectQueue.push([{ id: ALUNO, nomeCompleto: "Aluno", status: "inativo" }]);
    await expect(getAlunoAulaPlayer("ia", AULA, ALUNO)).rejects.toBeInstanceOf(AlunoAulaAlunoNotFoundError);
  });

  it("throws when aluno lacks acesso ao ambiente", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA", logoUrl: null, corPrimaria: null, corSecundaria: null, corFundo: null, corTexto: null, corBotao: null, corCard: null, corBorda: null, tema: "claro" }]);
    selectQueue.push([{ id: ALUNO, nomeCompleto: "Aluno", status: "ativo" }]);
    selectQueue.push([]);
    await expect(getAlunoAulaPlayer("ia", AULA, ALUNO)).rejects.toBeInstanceOf(AlunoAulaAccessDeniedError);
  });

  it("marks aula conclusao via upsert", async () => {
    queueAcesso();
    await setAlunoAulaConclusao("ia", AULA, ALUNO, true);
    expect(duplicateUpdated).toBe(true);
  });

  it("saves video progress via upsert", async () => {
    queueAcesso();
    await saveAlunoAulaProgresso("ia", AULA, ALUNO, 44, false);
    expect(duplicateUpdated).toBe(true);
  });

  it("creates comentario when under rate limit", async () => {
    queueAcesso();
    selectQueue.push([]);
    insertIds.push(COMENTARIO);
    const result = await createAlunoAulaComentario("ia", AULA, ALUNO, "Teste", null);
    expect(result.id).toBe(COMENTARIO);
  });

  it("blocks comentario when rate limit is exceeded", async () => {
    queueAcesso();
    selectQueue.push([{ id: "1" }, { id: "2" }, { id: "3" }, { id: "4" }, { id: "5" }]);
    await expect(createAlunoAulaComentario("ia", AULA, ALUNO, "Teste", null)).rejects.toBeInstanceOf(AlunoAulaComentarioRateLimitError);
  });

  it("removes own comentario", async () => {
    queueAcesso();
    selectQueue.push([{ id: COMENTARIO, aulaId: AULA, alunoId: ALUNO, status: "ativo" }]);
    await removeAlunoAulaComentario("ia", AULA, COMENTARIO, ALUNO);
    expect(updated).toBe(true);
  });

  it("rejects removing comentario from another aluno", async () => {
    queueAcesso();
    selectQueue.push([{ id: COMENTARIO, aulaId: AULA, alunoId: "outro", status: "ativo" }]);
    await expect(removeAlunoAulaComentario("ia", AULA, COMENTARIO, ALUNO)).rejects.toBeInstanceOf(AlunoAulaComentarioForbiddenError);
  });

  it("toggles curtida off when already liked", async () => {
    queueAcesso();
    selectQueue.push([{ id: COMENTARIO, aulaId: AULA, status: "ativo" }]);
    selectQueue.push([{ id: "like-1" }]);
    const result = await toggleAlunoAulaComentarioCurtida("ia", AULA, COMENTARIO, ALUNO);
    expect(result.liked).toBe(false);
    expect(deleted).toBe(true);
  });

  it("throws when comentario is missing on curtida", async () => {
    queueAcesso();
    selectQueue.push([]);
    await expect(toggleAlunoAulaComentarioCurtida("ia", AULA, COMENTARIO, ALUNO)).rejects.toBeInstanceOf(AlunoAulaComentarioNotFoundError);
  });

  it("throws when aula is missing during access resolution", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA", logoUrl: null, corPrimaria: null, corSecundaria: null, corFundo: null, corTexto: null, corBotao: null, corCard: null, corBorda: null, tema: "claro" }]);
    selectQueue.push([{ id: ALUNO, nomeCompleto: "Aluno", status: "ativo" }]);
    selectQueue.push([{ id: "vinc" }]);
    selectQueue.push([]);
    await expect(getAlunoAulaPlayer("ia", AULA, ALUNO)).rejects.toBeInstanceOf(AlunoAulaNotFoundError);
  });
});
