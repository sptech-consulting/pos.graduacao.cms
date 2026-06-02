import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock ───────────────────────────────────────────────────────────────────

const selectQueue: unknown[][] = [];
const insertQueue: string[] = [];
let updateCalled = false;
let deleteCallCount = 0;

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
          orderBy: async () => selectQueue.shift() ?? [],
        }),
        // supports: select().from().innerJoin().where().orderBy()
        innerJoin: () => ({
          where: () => ({
            orderBy: async () => selectQueue.shift() ?? [],
            limit: async () => selectQueue.shift() ?? [],
          }),
        }),
        orderBy: async () => selectQueue.shift() ?? [],
      }),
    }),
    insert: () => ({
      values: () => {
        const id = insertQueue.shift() ?? "default-id";
        return Object.assign(Promise.resolve(undefined), {
          $returningId: async () => [{ id }],
        });
      },
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          updateCalled = true;
        },
      }),
    }),
    delete: () => ({
      where: async () => {
        deleteCallCount++;
      },
    }),
  },
}));

import {
  AlunoJaVinculadoError,
  AlunoNaoVinculadoError,
  AlunoNotFoundError,
  EmailDuplicadoError,
  ImportacaoNotFoundError,
  createAluno,
  desvincularAluno,
  getAlunoDoAmbiente,
  getImportacaoById,
  importarAlunos,
  listAlunosDoAmbiente,
  listImportacaoErros,
  listImportacoes,
  updateAluno,
  updateAlunoStatus,
} from "./alunos.service.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const fakeAluno = {
  id: "aluno-1",
  nomeCompleto: "Ana Silva",
  emailAcesso: "ana@sptech.school",
  whatsapp: "11999990000",
  status: "ativo",
  criadoEm: new Date(),
  atualizadoEm: new Date(),
};

const fakeVinculo = {
  id: "vinculo-1",
  ambienteId: "amb-1",
  alunoId: "aluno-1",
  status: "ativo",
  origem: null,
  importacaoId: null,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
};

const fakeImportacao = {
  id: "import-1",
  ambienteId: "amb-1",
  totalLinhas: 1,
  totalImportados: 1,
  totalAtualizados: 0,
  totalErros: 0,
  status: "concluida",
  criadoPor: "admin-1",
  criadoEm: new Date(),
  finalizadoEm: new Date(),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("alunos.service", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertQueue.length = 0;
    updateCalled = false;
    deleteCallCount = 0;
  });

  // ── listAlunosDoAmbiente ────────────────────────────────────────────────────

  describe("listAlunosDoAmbiente", () => {
    it("returns alunos for ambiente (via join)", async () => {
      selectQueue.push([{ ...fakeAluno, vinculoStatus: "ativo" }]);

      const result = await listAlunosDoAmbiente("amb-1");

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe("aluno-1");
    });

    it("returns empty array when no alunos", async () => {
      selectQueue.push([]);
      expect(await listAlunosDoAmbiente("amb-1")).toHaveLength(0);
    });
  });

  // ── getAlunoDoAmbiente ──────────────────────────────────────────────────────

  describe("getAlunoDoAmbiente", () => {
    it("returns aluno when linked to ambiente", async () => {
      selectQueue.push([fakeAluno]); // get aluno by id
      selectQueue.push([fakeVinculo]); // check link

      const result = await getAlunoDoAmbiente("amb-1", "aluno-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("aluno-1");
    });

    it("throws AlunoNotFoundError when aluno does not exist", async () => {
      selectQueue.push([]); // aluno not found

      await expect(getAlunoDoAmbiente("amb-1", "missing")).rejects.toThrow(AlunoNotFoundError);
    });

    it("throws AlunoNaoVinculadoError when aluno not linked to ambiente (IDOR)", async () => {
      selectQueue.push([fakeAluno]); // aluno exists
      selectQueue.push([]); // link not found

      await expect(getAlunoDoAmbiente("amb-1", "aluno-1")).rejects.toThrow(AlunoNaoVinculadoError);
    });
  });

  // ── createAluno ─────────────────────────────────────────────────────────────

  describe("createAluno", () => {
    it("creates new aluno and links to ambiente", async () => {
      selectQueue.push([]); // find by email → not found
      insertQueue.push("new-aluno-id"); // insert aluno
      selectQueue.push([]); // findVinculo → not yet linked
      // insert ambienteAlunos (no ID used from queue)
      selectQueue.push([{ ...fakeAluno, id: "new-aluno-id" }]); // getById for return

      const result = await createAluno("amb-1", {
        nomeCompleto: "Ana Silva",
        emailAcesso: "ana@sptech.school",
      });

      expect(result.id).toBe("new-aluno-id");
    });

    it("links existing aluno to ambiente when email already exists", async () => {
      selectQueue.push([fakeAluno]); // aluno found by email
      selectQueue.push([]); // not yet linked to this ambiente
      selectQueue.push([fakeAluno]); // return aluno

      const result = await createAluno("amb-1", {
        nomeCompleto: "Ana Silva",
        emailAcesso: "ana@sptech.school",
      });

      expect(result.id).toBe("aluno-1");
    });

    it("throws AlunoJaVinculadoError when aluno already linked to ambiente", async () => {
      selectQueue.push([fakeAluno]); // aluno found by email
      selectQueue.push([fakeVinculo]); // already linked

      await expect(
        createAluno("amb-1", { nomeCompleto: "Ana", emailAcesso: "ana@sptech.school" }),
      ).rejects.toThrow(AlunoJaVinculadoError);
    });
  });

  // ── updateAluno ─────────────────────────────────────────────────────────────

  describe("updateAluno", () => {
    it("updates aluno fields and returns updated record", async () => {
      selectQueue.push([fakeVinculo]); // IDOR check — link exists
      // no email change, no uniqueness check needed
      selectQueue.push([{ ...fakeAluno, nomeCompleto: "Ana Santos" }]); // return updated

      const result = await updateAluno("amb-1", "aluno-1", { nomeCompleto: "Ana Santos" });

      expect(updateCalled).toBe(true);
      expect(result.nomeCompleto).toBe("Ana Santos");
    });

    it("throws AlunoNaoVinculadoError when aluno not in this ambiente (IDOR)", async () => {
      selectQueue.push([]); // link not found

      await expect(updateAluno("amb-1", "aluno-1", { nomeCompleto: "X" })).rejects.toThrow(
        AlunoNaoVinculadoError,
      );
    });

    it("throws EmailDuplicadoError when new email is taken by another aluno", async () => {
      selectQueue.push([fakeVinculo]); // link exists
      selectQueue.push([{ ...fakeAluno, id: "other-aluno" }]); // email already taken by different aluno

      await expect(
        updateAluno("amb-1", "aluno-1", { emailAcesso: "outro@sptech.school" }),
      ).rejects.toThrow(EmailDuplicadoError);
    });

    it("allows email update when email belongs to the same aluno", async () => {
      selectQueue.push([fakeVinculo]); // link exists
      selectQueue.push([fakeAluno]); // email found — but it IS the same aluno
      selectQueue.push([fakeAluno]); // return updated

      await expect(
        updateAluno("amb-1", "aluno-1", { emailAcesso: "ana@sptech.school" }),
      ).resolves.not.toThrow();
    });
  });

  // ── updateAlunoStatus ───────────────────────────────────────────────────────

  describe("updateAlunoStatus", () => {
    it("updates status of linked aluno", async () => {
      selectQueue.push([fakeVinculo]); // IDOR check

      await updateAlunoStatus("amb-1", "aluno-1", "inativo");

      expect(updateCalled).toBe(true);
    });

    it("throws AlunoNaoVinculadoError when not linked (IDOR)", async () => {
      selectQueue.push([]);
      await expect(updateAlunoStatus("amb-1", "aluno-1", "inativo")).rejects.toThrow(
        AlunoNaoVinculadoError,
      );
    });
  });

  // ── desvincularAluno ────────────────────────────────────────────────────────

  describe("desvincularAluno", () => {
    it("sets vinculo status to inativo", async () => {
      selectQueue.push([fakeVinculo]); // link exists

      await desvincularAluno("amb-1", "aluno-1");

      expect(updateCalled).toBe(true);
    });

    it("throws AlunoNaoVinculadoError when not linked (IDOR)", async () => {
      selectQueue.push([]);
      await expect(desvincularAluno("amb-1", "aluno-1")).rejects.toThrow(AlunoNaoVinculadoError);
    });
  });

  // ── importarAlunos ──────────────────────────────────────────────────────────

  describe("importarAlunos", () => {
    it("imports one new aluno and returns importacao with stats", async () => {
      insertQueue.push("import-1"); // insert importacao
      // row 1: email not found → new aluno
      selectQueue.push([]); // email lookup → not found
      insertQueue.push("new-aluno"); // insert aluno
      selectQueue.push([]); // findVinculo → not linked
      // insert ambienteAlunos (no ID used from queue)
      // update importacao
      selectQueue.push([{ ...fakeImportacao, id: "import-1", totalImportados: 1 }]); // final select

      const result = await importarAlunos(
        "amb-1",
        [{ nomeCompleto: "Ana Silva", emailAcesso: "ana@sptech.school" }],
        "admin-1",
      );

      expect(result.id).toBe("import-1");
    });

    it("records error for row with invalid email format", async () => {
      insertQueue.push("import-1"); // importacao record
      insertQueue.push("error-1"); // error record
      // no aluno insert (invalid email skipped)
      // update importacao
      selectQueue.push([{ ...fakeImportacao, id: "import-1", totalErros: 1 }]); // return

      const result = await importarAlunos(
        "amb-1",
        [{ nomeCompleto: "Sem Email", emailAcesso: "not-an-email" }],
        "admin-1",
      );

      expect(result.id).toBe("import-1");
    });
  });

  // ── listImportacoes ─────────────────────────────────────────────────────────

  describe("listImportacoes", () => {
    it("returns importacoes for ambiente", async () => {
      selectQueue.push([fakeImportacao]);
      expect(await listImportacoes("amb-1")).toHaveLength(1);
    });
  });

  // ── getImportacaoById ───────────────────────────────────────────────────────

  describe("getImportacaoById", () => {
    it("returns importacao when found", async () => {
      selectQueue.push([fakeImportacao]);
      const result = await getImportacaoById("import-1");
      expect(result?.id).toBe("import-1");
    });

    it("returns null when not found", async () => {
      selectQueue.push([]);
      expect(await getImportacaoById("missing")).toBeNull();
    });
  });

  // ── listImportacaoErros ─────────────────────────────────────────────────────

  describe("listImportacaoErros", () => {
    it("returns errors for importacao", async () => {
      selectQueue.push([fakeImportacao]); // existence check
      selectQueue.push([
        { id: "err-1", importacaoId: "import-1", numeroLinha: 1, erro: "Email inválido" },
      ]);

      const result = await listImportacaoErros("import-1");

      expect(result).toHaveLength(1);
    });

    it("throws ImportacaoNotFoundError when importacao not found", async () => {
      selectQueue.push([]);
      await expect(listImportacaoErros("missing")).rejects.toThrow(ImportacaoNotFoundError);
    });
  });
});
