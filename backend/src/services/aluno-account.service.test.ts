import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[][] = [];

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
          then: (resolve: (value: unknown[]) => unknown) => resolve(selectQueue.shift() ?? []),
        }),
      }),
    }),
  },
}));

import {
  AlunoAccountNotFoundError,
  checkAlunoAccessToAmbiente,
  getAlunoProfile,
  listAmbientesDoAluno,
} from "./aluno-account.service.js";

const ALUNO = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const AMB = "b2c3d4e5-f6a7-8901-bcde-f01234567891";

function reset() {
  selectQueue.length = 0;
}

describe("aluno-account.service", () => {
  beforeEach(reset);

  it("returns aluno profile when active", async () => {
    selectQueue.push([{ id: ALUNO, nomeCompleto: "Ana", emailAcesso: "ana@x.com", status: "ativo" }]);
    const result = await getAlunoProfile(ALUNO);
    expect(result.id).toBe(ALUNO);
  });

  it("throws when aluno profile is missing", async () => {
    selectQueue.push([]);
    await expect(getAlunoProfile(ALUNO)).rejects.toBeInstanceOf(AlunoAccountNotFoundError);
  });

  it("returns acesso ok when aluno is linked to active ambiente", async () => {
    selectQueue.push([{ id: AMB, status: "ativo" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([{ id: "link-1", status: "ativo" }]);
    await expect(checkAlunoAccessToAmbiente("ia", ALUNO)).resolves.toEqual({ ok: true });
  });

  it("returns not_found when ambiente is missing", async () => {
    selectQueue.push([]);
    await expect(checkAlunoAccessToAmbiente("ia", ALUNO)).resolves.toEqual({ ok: false, reason: "not_found" });
  });

  it("returns inativo when ambiente is not active", async () => {
    selectQueue.push([{ id: AMB, status: "inativo" }]);
    await expect(checkAlunoAccessToAmbiente("ia", ALUNO)).resolves.toEqual({ ok: false, reason: "inativo" });
  });

  it("returns no_aluno when aluno is inactive", async () => {
    selectQueue.push([{ id: AMB, status: "ativo" }]);
    selectQueue.push([{ id: ALUNO, status: "bloqueado" }]);
    await expect(checkAlunoAccessToAmbiente("ia", ALUNO)).resolves.toEqual({ ok: false, reason: "no_aluno" });
  });

  it("returns no_link when aluno is not linked", async () => {
    selectQueue.push([{ id: AMB, status: "ativo" }]);
    selectQueue.push([{ id: ALUNO, status: "ativo" }]);
    selectQueue.push([]);
    await expect(checkAlunoAccessToAmbiente("ia", ALUNO)).resolves.toEqual({ ok: false, reason: "no_link" });
  });

  it("lists ambientes ativos do aluno", async () => {
    selectQueue.push([{ id: ALUNO, nomeCompleto: "Ana", emailAcesso: "ana@x.com", status: "ativo" }]);
    selectQueue.push([{ ambienteId: AMB }]);
    selectQueue.push([{ id: AMB, nome: "IA", slug: "ia", corPrimaria: "#ED145B", imagemCapaUrl: null, status: "ativo" }]);
    const result = await listAmbientesDoAluno(ALUNO);
    expect(result.aluno.nomeCompleto).toBe("Ana");
    expect(result.ambientes).toHaveLength(1);
  });
});
