import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[][] = [];

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
          orderBy: async () => selectQueue.shift() ?? [],
        }),
      }),
    }),
  },
}));

import {
  AlunoFerramentaAccessDeniedError,
  AlunoFerramentaAlunoNotFoundError,
  AlunoFerramentaAmbienteNotFoundError,
  AlunoFerramentaNotFoundError,
  getAlunoFerramentaDetalhe,
} from "./aluno-ferramentas.service.js";

const AMBIENTE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ALUNO = "b2c3d4e5-f6a7-8901-bcde-f01234567891";
const FERRAMENTA = "c3d4e5f6-a7b8-9012-cdef-0123456789ab";

function reset() {
  selectQueue.length = 0;
}

describe("getAlunoFerramentaDetalhe", () => {
  beforeEach(reset);

  it("returns ferramenta detail with subresources", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([{ id: "vinc-a" }]);
    selectQueue.push([
      {
        id: FERRAMENTA,
        nome: "Ferramenta",
        descricao: "Descrição",
        subtitulo: null,
        descricaoLonga: null,
        url: null,
        iconeUrl: null,
        imagemCapaUrl: null,
        categoria: null,
        tipoAbertura: "nova_aba",
        fraseDestaque: null,
        status: "ativo",
      },
    ]);
    selectQueue.push([{ id: "vinc-f" }]);
    selectQueue.push([{ id: "cu-1", texto: "Uso" }]);
    selectQueue.push([{ id: "tag-1", tipo: "input", rotulo: "Texto" }]);
    selectQueue.push([{ id: "bl-1", titulo: "Bloco", conteudo: "Conteúdo" }]);
    selectQueue.push([{ id: "fn-1", titulo: "Func", descricao: null, imagemUrl: null }]);
    selectQueue.push([{ id: "ct-1", titulo: "Caso", badge: null, promptExemplo: null, explicacao: null }]);

    const result = await getAlunoFerramentaDetalhe("ia", FERRAMENTA, ALUNO);

    expect(result.id).toBe(FERRAMENTA);
    expect(result.ambienteSlug).toBe("ia");
    expect(result.tags[0]?.tipo).toBe("input");
  });

  it("throws AlunoFerramentaAmbienteNotFoundError when ambiente is missing", async () => {
    selectQueue.push([]);

    await expect(getAlunoFerramentaDetalhe("ia", FERRAMENTA, ALUNO)).rejects.toBeInstanceOf(
      AlunoFerramentaAmbienteNotFoundError,
    );
  });

  it("throws AlunoFerramentaAlunoNotFoundError when aluno is inactive", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "inativo" }]);

    await expect(getAlunoFerramentaDetalhe("ia", FERRAMENTA, ALUNO)).rejects.toBeInstanceOf(
      AlunoFerramentaAlunoNotFoundError,
    );
  });

  it("throws AlunoFerramentaAccessDeniedError when aluno has no ambiente link", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([]);

    await expect(getAlunoFerramentaDetalhe("ia", FERRAMENTA, ALUNO)).rejects.toBeInstanceOf(
      AlunoFerramentaAccessDeniedError,
    );
  });

  it("throws AlunoFerramentaNotFoundError when ferramenta is missing", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([{ id: "vinc-a" }]);
    selectQueue.push([]);

    await expect(getAlunoFerramentaDetalhe("ia", FERRAMENTA, ALUNO)).rejects.toBeInstanceOf(
      AlunoFerramentaNotFoundError,
    );
  });

  it("throws AlunoFerramentaNotFoundError when ferramenta is not linked to ambiente", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([{ id: "vinc-a" }]);
    selectQueue.push([
      {
        id: FERRAMENTA,
        nome: "Ferramenta",
        descricao: null,
        subtitulo: null,
        descricaoLonga: null,
        url: null,
        iconeUrl: null,
        imagemCapaUrl: null,
        categoria: null,
        tipoAbertura: "nova_aba",
        fraseDestaque: null,
        status: "ativo",
      },
    ]);
    selectQueue.push([]);

    await expect(getAlunoFerramentaDetalhe("ia", FERRAMENTA, ALUNO)).rejects.toBeInstanceOf(
      AlunoFerramentaNotFoundError,
    );
  });
});
