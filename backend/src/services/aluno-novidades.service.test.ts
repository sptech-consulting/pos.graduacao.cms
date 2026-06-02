import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[][] = [];

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
        }),
      }),
    }),
  },
}));

import {
  AlunoNovidadeAccessDeniedError,
  AlunoNovidadeAlunoNotFoundError,
  AlunoNovidadeAmbienteNotFoundError,
  AlunoNovidadeNotFoundError,
  getAlunoNovidadeDetalhe,
} from "./aluno-novidades.service.js";

const AMBIENTE = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const ALUNO = "b2c3d4e5-f6a7-8901-bcde-f01234567891";
const NOVIDADE = "c3d4e5f6-a7b8-9012-cdef-0123456789ab";

function reset() {
  selectQueue.length = 0;
}

describe("getAlunoNovidadeDetalhe", () => {
  beforeEach(reset);

  it("returns novidade details for aluno with ambiente access", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([{ id: "vinc-1" }]);
    selectQueue.push([
      {
        id: NOVIDADE,
        titulo: "Lançamento",
        resumo: "Resumo",
        conteudo: "Conteúdo",
        imagemUrl: null,
        fonteUrl: null,
        fonteNome: null,
        categoria: "produto",
        publicadoEm: null,
        ambienteId: AMBIENTE,
      },
    ]);

    const result = await getAlunoNovidadeDetalhe("ia", NOVIDADE, ALUNO);

    expect(result.id).toBe(NOVIDADE);
    expect(result.ambienteSlug).toBe("ia");
    expect(result.ambienteNome).toBe("IA");
  });

  it("throws AlunoNovidadeAmbienteNotFoundError when ambiente does not exist", async () => {
    selectQueue.push([]);

    await expect(getAlunoNovidadeDetalhe("ia", NOVIDADE, ALUNO)).rejects.toBeInstanceOf(
      AlunoNovidadeAmbienteNotFoundError,
    );
  });

  it("throws AlunoNovidadeAlunoNotFoundError when aluno is inactive", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "inativo" }]);

    await expect(getAlunoNovidadeDetalhe("ia", NOVIDADE, ALUNO)).rejects.toBeInstanceOf(
      AlunoNovidadeAlunoNotFoundError,
    );
  });

  it("throws AlunoNovidadeAccessDeniedError when aluno lacks ambiente link", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([]);

    await expect(getAlunoNovidadeDetalhe("ia", NOVIDADE, ALUNO)).rejects.toBeInstanceOf(
      AlunoNovidadeAccessDeniedError,
    );
  });

  it("throws AlunoNovidadeNotFoundError when novidade is missing", async () => {
    selectQueue.push([{ id: AMBIENTE, slug: "ia", nome: "IA" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([{ id: "vinc-1" }]);
    selectQueue.push([]);

    await expect(getAlunoNovidadeDetalhe("ia", NOVIDADE, ALUNO)).rejects.toBeInstanceOf(
      AlunoNovidadeNotFoundError,
    );
  });
});
