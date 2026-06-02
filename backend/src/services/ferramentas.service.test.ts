import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock — queue-based ────────────────────────────────────────────────────

const selectQueue: unknown[][] = [];
let insertIdResult = "new-id";
let deleteCallCount = 0;
let updateCalled = false;

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
          orderBy: async () => selectQueue.shift() ?? [],
        }),
        orderBy: async () => selectQueue.shift() ?? [],
      }),
    }),
    insert: () => ({
      values: () => ({
        $returningId: async () => [{ id: insertIdResult }],
      }),
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
  FerramentaNotFoundError,
  SubRecursoNotFoundError,
  addBloco,
  addCasoTeste,
  addCasoUso,
  addFuncionalidade,
  addTag,
  createFerramenta,
  deleteFerramenta,
  getFerramentaById,
  listFerramentas,
  removeBloco,
  removeCasoTeste,
  removeCasoUso,
  removeFuncionalidade,
  removeTag,
  updateFerramenta,
} from "./ferramentas.service.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const fakeFerramenta = {
  id: "ferr-uuid-1",
  nome: "ChatGPT",
  subtitulo: null,
  descricao: null,
  descricaoLonga: null,
  url: "https://chat.openai.com",
  iconeUrl: null,
  imagemCapaUrl: null,
  fraseDestaque: null,
  categoria: "IA",
  tipoAbertura: "nova_aba",
  status: "ativo",
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  criadoPor: "admin-1",
};

const fakeCasoUso = {
  id: "cu-1",
  ferramentaId: "ferr-uuid-1",
  texto: "Gerar código",
  ordem: 0,
  criadoEm: new Date(),
};
const fakeTag = {
  id: "tag-1",
  ferramentaId: "ferr-uuid-1",
  tipo: "input",
  rotulo: "Texto",
  ordem: 0,
  criadoEm: new Date(),
};
const fakeBloco = {
  id: "bloco-1",
  ferramentaId: "ferr-uuid-1",
  titulo: "Bloco 1",
  conteudo: "...",
  ordem: 0,
  criadoEm: new Date(),
};
const fakeFunc = {
  id: "func-1",
  ferramentaId: "ferr-uuid-1",
  titulo: "Func 1",
  descricao: null,
  imagemUrl: null,
  ordem: 0,
  criadoEm: new Date(),
};
const fakeCasoTeste = {
  id: "ct-1",
  ferramentaId: "ferr-uuid-1",
  titulo: "Caso 1",
  badge: null,
  promptExemplo: null,
  explicacao: null,
  ordem: 0,
  criadoEm: new Date(),
};

// Push 6 items: ferramenta + 5 sub-recursos (ordered)
function pushGetByIdSuccess() {
  selectQueue.push([fakeFerramenta]);
  selectQueue.push([fakeCasoUso]); // casos_uso
  selectQueue.push([fakeTag]); // tags
  selectQueue.push([fakeBloco]); // blocos
  selectQueue.push([fakeFunc]); // funcionalidades
  selectQueue.push([fakeCasoTeste]); // casos_teste
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ferramentas.service", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertIdResult = "new-id";
    deleteCallCount = 0;
    updateCalled = false;
  });

  // ── listFerramentas ─────────────────────────────────────────────────────────

  describe("listFerramentas", () => {
    it("returns list ordered by nome", async () => {
      selectQueue.push([fakeFerramenta]);
      expect(await listFerramentas()).toHaveLength(1);
    });

    it("returns empty array when none exist", async () => {
      selectQueue.push([]);
      expect(await listFerramentas()).toHaveLength(0);
    });
  });

  // ── createFerramenta ────────────────────────────────────────────────────────

  describe("createFerramenta", () => {
    it("creates and returns the new ferramenta", async () => {
      insertIdResult = "new-ferr-id";
      selectQueue.push([{ ...fakeFerramenta, id: "new-ferr-id" }]);

      const result = await createFerramenta({ nome: "ChatGPT" }, "admin-1");

      expect(result.id).toBe("new-ferr-id");
      expect(result.nome).toBe("ChatGPT");
    });
  });

  // ── getFerramentaById ───────────────────────────────────────────────────────

  describe("getFerramentaById", () => {
    it("returns ferramenta with all sub-recursos", async () => {
      pushGetByIdSuccess();

      const result = await getFerramentaById("ferr-uuid-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("ferr-uuid-1");
      expect(result?.casosUso).toHaveLength(1);
      expect(result?.tags).toHaveLength(1);
      expect(result?.blocos).toHaveLength(1);
      expect(result?.funcionalidades).toHaveLength(1);
      expect(result?.casosTeste).toHaveLength(1);
    });

    it("returns null when not found", async () => {
      selectQueue.push([]);
      expect(await getFerramentaById("missing")).toBeNull();
    });
  });

  // ── updateFerramenta ────────────────────────────────────────────────────────

  describe("updateFerramenta", () => {
    it("updates and returns updated ferramenta", async () => {
      selectQueue.push([fakeFerramenta]); // existence check
      // getFerramentaById for return
      pushGetByIdSuccess();

      const result = await updateFerramenta("ferr-uuid-1", { nome: "GPT-4" });

      expect(updateCalled).toBe(true);
      expect(result.id).toBe("ferr-uuid-1");
    });

    it("throws FerramentaNotFoundError when not found", async () => {
      selectQueue.push([]);
      await expect(updateFerramenta("missing", { nome: "X" })).rejects.toThrow(
        FerramentaNotFoundError,
      );
    });
  });

  // ── deleteFerramenta ────────────────────────────────────────────────────────

  describe("deleteFerramenta", () => {
    it("deletes ferramenta and all sub-recursos (cascade)", async () => {
      selectQueue.push([fakeFerramenta]); // existence check

      await deleteFerramenta("ferr-uuid-1");

      // 6 deletes: 5 sub-recursos + 1 ferramenta
      expect(deleteCallCount).toBe(6);
    });

    it("throws FerramentaNotFoundError when not found", async () => {
      selectQueue.push([]);
      await expect(deleteFerramenta("missing")).rejects.toThrow(FerramentaNotFoundError);
    });
  });

  // ── addCasoUso ──────────────────────────────────────────────────────────────

  describe("addCasoUso", () => {
    it("adds caso de uso to ferramenta", async () => {
      insertIdResult = "cu-new";
      selectQueue.push([fakeFerramenta]); // ferramenta exists
      selectQueue.push([{ ...fakeCasoUso, id: "cu-new" }]); // getById after insert

      const result = await addCasoUso("ferr-uuid-1", { texto: "Gerar código", ordem: 0 });

      expect(result.id).toBe("cu-new");
      expect(result.ferramentaId).toBe("ferr-uuid-1");
    });

    it("throws FerramentaNotFoundError when ferramenta does not exist", async () => {
      selectQueue.push([]);
      await expect(addCasoUso("missing", { texto: "X", ordem: 0 })).rejects.toThrow(
        FerramentaNotFoundError,
      );
    });
  });

  // ── removeCasoUso ───────────────────────────────────────────────────────────

  describe("removeCasoUso", () => {
    it("removes caso de uso", async () => {
      selectQueue.push([fakeCasoUso]); // find by id
      await removeCasoUso("ferr-uuid-1", "cu-1");
      expect(deleteCallCount).toBe(1);
    });

    it("throws SubRecursoNotFoundError when item not found", async () => {
      selectQueue.push([]);
      await expect(removeCasoUso("ferr-uuid-1", "missing")).rejects.toThrow(
        SubRecursoNotFoundError,
      );
    });

    it("throws SubRecursoNotFoundError when item belongs to different ferramenta (IDOR)", async () => {
      selectQueue.push([{ ...fakeCasoUso, ferramentaId: "other-ferramenta" }]);
      await expect(removeCasoUso("ferr-uuid-1", "cu-1")).rejects.toThrow(SubRecursoNotFoundError);
    });
  });

  // ── addTag ──────────────────────────────────────────────────────────────────

  describe("addTag", () => {
    it("adds tag to ferramenta", async () => {
      insertIdResult = "tag-new";
      selectQueue.push([fakeFerramenta]);
      selectQueue.push([{ ...fakeTag, id: "tag-new" }]);

      const result = await addTag("ferr-uuid-1", { tipo: "input", rotulo: "Texto", ordem: 0 });

      expect(result.id).toBe("tag-new");
    });

    it("throws FerramentaNotFoundError when ferramenta does not exist", async () => {
      selectQueue.push([]);
      await expect(addTag("missing", { tipo: "input", rotulo: "X", ordem: 0 })).rejects.toThrow(
        FerramentaNotFoundError,
      );
    });
  });

  // ── removeTag ───────────────────────────────────────────────────────────────

  describe("removeTag", () => {
    it("removes tag", async () => {
      selectQueue.push([fakeTag]);
      await removeTag("ferr-uuid-1", "tag-1");
      expect(deleteCallCount).toBe(1);
    });

    it("throws SubRecursoNotFoundError for IDOR attempt", async () => {
      selectQueue.push([{ ...fakeTag, ferramentaId: "other" }]);
      await expect(removeTag("ferr-uuid-1", "tag-1")).rejects.toThrow(SubRecursoNotFoundError);
    });
  });

  // ── addBloco ─────────────────────────────────────────────────────────────────

  describe("addBloco", () => {
    it("adds bloco to ferramenta", async () => {
      insertIdResult = "bloco-new";
      selectQueue.push([fakeFerramenta]);
      selectQueue.push([{ ...fakeBloco, id: "bloco-new" }]);

      const result = await addBloco("ferr-uuid-1", { titulo: "B", conteudo: "C", ordem: 0 });

      expect(result.id).toBe("bloco-new");
    });
  });

  // ── removeBloco ──────────────────────────────────────────────────────────────

  describe("removeBloco", () => {
    it("removes bloco", async () => {
      selectQueue.push([fakeBloco]);
      await removeBloco("ferr-uuid-1", "bloco-1");
      expect(deleteCallCount).toBe(1);
    });

    it("throws SubRecursoNotFoundError for IDOR attempt", async () => {
      selectQueue.push([{ ...fakeBloco, ferramentaId: "other" }]);
      await expect(removeBloco("ferr-uuid-1", "bloco-1")).rejects.toThrow(SubRecursoNotFoundError);
    });
  });

  // ── addFuncionalidade ────────────────────────────────────────────────────────

  describe("addFuncionalidade", () => {
    it("adds funcionalidade to ferramenta", async () => {
      insertIdResult = "func-new";
      selectQueue.push([fakeFerramenta]);
      selectQueue.push([{ ...fakeFunc, id: "func-new" }]);

      const result = await addFuncionalidade("ferr-uuid-1", { titulo: "F", ordem: 0 });

      expect(result.id).toBe("func-new");
    });
  });

  // ── removeFuncionalidade ─────────────────────────────────────────────────────

  describe("removeFuncionalidade", () => {
    it("removes funcionalidade", async () => {
      selectQueue.push([fakeFunc]);
      await removeFuncionalidade("ferr-uuid-1", "func-1");
      expect(deleteCallCount).toBe(1);
    });

    it("throws SubRecursoNotFoundError for IDOR attempt", async () => {
      selectQueue.push([{ ...fakeFunc, ferramentaId: "other" }]);
      await expect(removeFuncionalidade("ferr-uuid-1", "func-1")).rejects.toThrow(
        SubRecursoNotFoundError,
      );
    });
  });

  // ── addCasoTeste ─────────────────────────────────────────────────────────────

  describe("addCasoTeste", () => {
    it("adds caso de teste to ferramenta", async () => {
      insertIdResult = "ct-new";
      selectQueue.push([fakeFerramenta]);
      selectQueue.push([{ ...fakeCasoTeste, id: "ct-new" }]);

      const result = await addCasoTeste("ferr-uuid-1", { titulo: "CT", ordem: 0 });

      expect(result.id).toBe("ct-new");
    });
  });

  // ── removeCasoTeste ──────────────────────────────────────────────────────────

  describe("removeCasoTeste", () => {
    it("removes caso de teste", async () => {
      selectQueue.push([fakeCasoTeste]);
      await removeCasoTeste("ferr-uuid-1", "ct-1");
      expect(deleteCallCount).toBe(1);
    });

    it("throws SubRecursoNotFoundError for IDOR attempt", async () => {
      selectQueue.push([{ ...fakeCasoTeste, ferramentaId: "other" }]);
      await expect(removeCasoTeste("ferr-uuid-1", "ct-1")).rejects.toThrow(SubRecursoNotFoundError);
    });
  });
});
