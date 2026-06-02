import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock — queue-based so each call pops the next result ──────────────────
// Must be declared before vi.mock() is called (factory runs synchronously).

const selectQueue: unknown[][] = [];
let insertIdResult = "new-ambiente-id";
let updateCalled = false;
let deleteCalled = false;

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
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
        deleteCalled = true;
      },
    }),
  },
}));

// ── Static import — same module instance as the mock above ───────────────────

import {
  AmbienteHasActiveMembersError,
  AmbienteNotFoundError,
  SlugConflictError,
  createAmbiente,
  deleteAmbiente,
  getAmbienteById,
  listAmbientes,
  updateAmbiente,
  updateAmbienteStatus,
} from "./ambientes.service.js";

// ── Helpers ──────────────────────────────────────────────────────────────────

const fakeAmbiente = {
  id: "amb-uuid-1",
  nome: "Pós Tech",
  slug: "pos-tech",
  descricao: null,
  status: "ativo",
  logoUrl: null,
  faviconUrl: null,
  imagemCapaUrl: null,
  imagemLoginUrl: null,
  corPrimaria: "#ED145B",
  corSecundaria: "#1F2A44",
  corFundo: "#FFFFFF",
  corTexto: "#1F2A44",
  corBotao: "#ED145B",
  corCard: "#FFFFFF",
  corBorda: "#D0D3D4",
  tema: "claro",
  layoutHome: {},
  cardEstilo: "sombra",
  cardBorda: "arredondado",
  cardTamanho: "medio",
  cardExibirIcone: true,
  cardExibirImagem: true,
  cardSombra: true,
  efeitoCardTilt3d: false,
  efeitoCardGlow: false,
  efeitoCardScale: false,
  efeitoBotaoLift: false,
  efeitoEntradaAnimada: false,
  efeitoSomHover: false,
  efeitoSomVolume: 40,
  efeitoBlobsFundo: false,
  webhookToken: null,
  codigoAcessoResultados: null,
  playbookTitulo: null,
  playbookDescricao: null,
  playbookCapaUrl: null,
  playbookArquivoUrl: null,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  criadoPor: "admin-uuid-1",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ambientes.service", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertIdResult = "new-ambiente-id";
    updateCalled = false;
    deleteCalled = false;
  });

  // ── createAmbiente ──────────────────────────────────────────────────────────

  describe("createAmbiente", () => {
    it("creates and returns the new ambiente", async () => {
      selectQueue.push([]); // slugExists → not found
      selectQueue.push([{ ...fakeAmbiente, id: "new-ambiente-id" }]); // getAmbienteById after insert

      const result = await createAmbiente({ nome: "Pós Tech", slug: "pos-tech" }, "admin-uuid-1");

      expect(result.id).toBe("new-ambiente-id");
      expect(result.slug).toBe("pos-tech");
    });

    it("normalizes slug to lowercase", async () => {
      selectQueue.push([]);
      selectQueue.push([{ ...fakeAmbiente, id: "new-ambiente-id", slug: "pos-tech" }]);

      const result = await createAmbiente({ nome: "Pós Tech", slug: "POS-TECH" }, "admin-uuid-1");

      expect(result.slug).toBe("pos-tech");
    });

    it("throws SlugConflictError when slug already exists", async () => {
      selectQueue.push([{ id: "other-id" }]); // slugExists → found

      await expect(
        createAmbiente({ nome: "Pós Tech", slug: "pos-tech" }, "admin-uuid-1"),
      ).rejects.toThrow(SlugConflictError);
    });
  });

  // ── listAmbientes ───────────────────────────────────────────────────────────

  describe("listAmbientes", () => {
    it("returns list of ambientes ordered by nome", async () => {
      selectQueue.push([fakeAmbiente]);

      const result = await listAmbientes();

      expect(result).toHaveLength(1);
      expect(result[0]?.id).toBe(fakeAmbiente.id);
    });

    it("returns empty array when no ambientes exist", async () => {
      selectQueue.push([]);

      const result = await listAmbientes();

      expect(result).toHaveLength(0);
    });
  });

  // ── getAmbienteById ─────────────────────────────────────────────────────────

  describe("getAmbienteById", () => {
    it("returns ambiente when found", async () => {
      selectQueue.push([fakeAmbiente]);

      const result = await getAmbienteById("amb-uuid-1");

      expect(result).not.toBeNull();
      expect(result?.id).toBe("amb-uuid-1");
    });

    it("returns null when not found", async () => {
      selectQueue.push([]);

      const result = await getAmbienteById("nonexistent-id");

      expect(result).toBeNull();
    });
  });

  // ── updateAmbiente ──────────────────────────────────────────────────────────

  describe("updateAmbiente", () => {
    it("updates and returns the updated ambiente", async () => {
      selectQueue.push([fakeAmbiente]); // getAmbienteById (existence check)
      selectQueue.push([{ ...fakeAmbiente, nome: "Pós Tech 2" }]); // getAmbienteById (return updated)

      const result = await updateAmbiente("amb-uuid-1", { nome: "Pós Tech 2" });

      expect(updateCalled).toBe(true);
      expect(result.nome).toBe("Pós Tech 2");
    });

    it("throws AmbienteNotFoundError when ambiente does not exist", async () => {
      selectQueue.push([]); // getAmbienteById → not found

      await expect(updateAmbiente("nonexistent-id", { nome: "X" })).rejects.toThrow(
        AmbienteNotFoundError,
      );
    });

    it("throws SlugConflictError when new slug is already taken", async () => {
      selectQueue.push([fakeAmbiente]); // getAmbienteById → exists
      selectQueue.push([{ id: "other-id" }]); // slugExists → conflict

      await expect(updateAmbiente("amb-uuid-1", { slug: "taken-slug" })).rejects.toThrow(
        SlugConflictError,
      );
    });

    it("allows updating slug to the same value (no conflict with self)", async () => {
      selectQueue.push([fakeAmbiente]); // getAmbienteById → exists
      selectQueue.push([{ id: "amb-uuid-1" }]); // slugExists → same id, not a conflict
      selectQueue.push([fakeAmbiente]); // getAmbienteById (return updated)

      await expect(updateAmbiente("amb-uuid-1", { slug: "pos-tech" })).resolves.not.toThrow();
    });
  });

  // ── updateAmbienteStatus ────────────────────────────────────────────────────

  describe("updateAmbienteStatus", () => {
    it("updates status of existing ambiente", async () => {
      selectQueue.push([fakeAmbiente]);

      await updateAmbienteStatus("amb-uuid-1", "inativo");

      expect(updateCalled).toBe(true);
    });

    it("throws AmbienteNotFoundError when ambiente does not exist", async () => {
      selectQueue.push([]);

      await expect(updateAmbienteStatus("nonexistent-id", "inativo")).rejects.toThrow(
        AmbienteNotFoundError,
      );
    });
  });

  // ── deleteAmbiente ──────────────────────────────────────────────────────────

  describe("deleteAmbiente", () => {
    it("deletes ambiente with no active alunos", async () => {
      selectQueue.push([fakeAmbiente]); // getAmbienteById → exists
      selectQueue.push([]); // active alunos check → none

      await deleteAmbiente("amb-uuid-1");

      expect(deleteCalled).toBe(true);
    });

    it("throws AmbienteNotFoundError when ambiente does not exist", async () => {
      selectQueue.push([]);

      await expect(deleteAmbiente("nonexistent-id")).rejects.toThrow(AmbienteNotFoundError);
    });

    it("throws AmbienteHasActiveMembersError when active alunos exist", async () => {
      selectQueue.push([fakeAmbiente]); // getAmbienteById → exists
      selectQueue.push([{ id: "aluno-link-id" }]); // active alunos check → found

      await expect(deleteAmbiente("amb-uuid-1")).rejects.toThrow(AmbienteHasActiveMembersError);
    });
  });
});
