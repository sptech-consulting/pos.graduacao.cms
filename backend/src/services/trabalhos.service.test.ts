import { beforeEach, describe, expect, it, vi } from "vitest";

// ── DB mock — queue-based ────────────────────────────────────────────────────

const selectQueue: unknown[][] = [];
let insertIdResult = "new-id";
let updateCalled = false;
let deleteCalled = false;

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
          orderBy: async () => selectQueue.shift() ?? [],
        }),
        orderBy: async () => selectQueue.shift() ?? [],
        innerJoin: () => ({
          where: () => ({
            orderBy: async () => selectQueue.shift() ?? [],
          }),
        }),
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

import {
  TrabalhoNotFoundError,
  createTrabalho,
  deleteTrabalho,
  getTrabalhoById,
  getTrabalhoPublico,
  listTrabalhos,
  listTrabalhosPublicos,
  updateTrabalho,
} from "./trabalhos.service.js";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const AMB = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";
const TRAB = "b2c3d4e5-f6a7-8901-bcde-f01234567891";

const fakeTrabalho = {
  id: TRAB,
  ambienteId: AMB,
  titulo: "Sistema de Gestão",
  autorNome: "Ana Silva",
  status: "publicada" as const,
  destaque: false,
  ordem: 0,
  visualizacoes: 0,
  tags: [],
};

function reset() {
  selectQueue.length = 0;
  insertIdResult = "new-id";
  updateCalled = false;
  deleteCalled = false;
}

// ── listTrabalhos ─────────────────────────────────────────────────────────────

describe("listTrabalhos", () => {
  beforeEach(reset);

  it("returns list of trabalhos for ambiente", async () => {
    selectQueue.push([fakeTrabalho]);
    const result = await listTrabalhos(AMB);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe(TRAB);
  });

  it("returns empty array when no trabalhos", async () => {
    selectQueue.push([]);
    const result = await listTrabalhos(AMB);
    expect(result).toHaveLength(0);
  });
});

// ── listTrabalhosPublicos ─────────────────────────────────────────────────────

describe("listTrabalhosPublicos", () => {
  beforeEach(reset);

  it("returns only published trabalhos", async () => {
    selectQueue.push([fakeTrabalho]);
    const result = await listTrabalhosPublicos(AMB);
    expect(result).toHaveLength(1);
  });

  it("returns empty when none published", async () => {
    selectQueue.push([]);
    const result = await listTrabalhosPublicos(AMB);
    expect(result).toHaveLength(0);
  });
});

// ── getTrabalhoById ───────────────────────────────────────────────────────────

describe("getTrabalhoById", () => {
  beforeEach(reset);

  it("returns trabalho when found", async () => {
    selectQueue.push([fakeTrabalho]);
    const result = await getTrabalhoById(TRAB);
    expect(result.id).toBe(TRAB);
  });

  it("throws TrabalhoNotFoundError when not found", async () => {
    selectQueue.push([]);
    await expect(getTrabalhoById(TRAB)).rejects.toBeInstanceOf(TrabalhoNotFoundError);
  });
});

// ── getTrabalhoPublico ────────────────────────────────────────────────────────

describe("getTrabalhoPublico", () => {
  beforeEach(reset);

  it("returns published trabalho and increments views", async () => {
    selectQueue.push([fakeTrabalho]);
    const result = await getTrabalhoPublico(AMB, TRAB);
    expect(result.id).toBe(TRAB);
    expect(updateCalled).toBe(true);
  });

  it("throws TrabalhoNotFoundError when not in ambiente", async () => {
    selectQueue.push([]);
    await expect(getTrabalhoPublico(AMB, TRAB)).rejects.toBeInstanceOf(TrabalhoNotFoundError);
  });
});

// ── createTrabalho ────────────────────────────────────────────────────────────

describe("createTrabalho", () => {
  beforeEach(reset);

  it("creates trabalho and returns it", async () => {
    insertIdResult = TRAB;
    selectQueue.push([fakeTrabalho]);
    const result = await createTrabalho(AMB, {
      titulo: "Sistema de Gestão",
      autorNome: "Ana Silva",
    });
    expect(result.id).toBe(TRAB);
  });
});

// ── updateTrabalho ────────────────────────────────────────────────────────────

describe("updateTrabalho", () => {
  beforeEach(reset);

  it("updates trabalho and returns updated record", async () => {
    selectQueue.push([fakeTrabalho]); // assertExists
    selectQueue.push([{ ...fakeTrabalho, titulo: "Novo Título" }]); // refetch
    const result = await updateTrabalho(TRAB, { titulo: "Novo Título" });
    expect(updateCalled).toBe(true);
    expect(result.titulo).toBe("Novo Título");
  });

  it("throws TrabalhoNotFoundError when not found on update", async () => {
    selectQueue.push([]);
    await expect(updateTrabalho(TRAB, { titulo: "X" })).rejects.toBeInstanceOf(
      TrabalhoNotFoundError,
    );
  });
});

// ── deleteTrabalho ────────────────────────────────────────────────────────────

describe("deleteTrabalho", () => {
  beforeEach(reset);

  it("deletes trabalho when found", async () => {
    selectQueue.push([fakeTrabalho]);
    await deleteTrabalho(AMB, TRAB);
    expect(deleteCalled).toBe(true);
  });

  it("throws TrabalhoNotFoundError when not found", async () => {
    selectQueue.push([]);
    await expect(deleteTrabalho(AMB, TRAB)).rejects.toBeInstanceOf(TrabalhoNotFoundError);
  });
});
