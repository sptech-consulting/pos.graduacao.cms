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
  AulaNotFoundError,
  CursoHasModulosError,
  CursoNotFoundError,
  ModuloHasAulasError,
  ModuloNotFoundError,
  createAula,
  createCurso,
  createModulo,
  deleteAula,
  deleteCurso,
  deleteModulo,
  getCursoById,
  getModuloById,
  listAulasByModulo,
  listCursos,
  listModulosByCurso,
  updateAula,
  updateCurso,
  updateModulo,
} from "./cursos.service.js";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const fakeCurso = {
  id: "curso-uuid-1",
  titulo: "React Avançado",
  descricao: "Curso de React",
  capaUrl: null,
  categoria: "Frontend",
  cargaHorariaMinutos: 600,
  nivel: "avancado",
  status: "rascunho",
  criadoPor: "admin-1",
  criadoEm: new Date(),
  atualizadoEm: new Date(),
};

const fakeModulo = {
  id: "modulo-uuid-1",
  cursoId: "curso-uuid-1",
  titulo: "Módulo 1",
  descricao: null,
  ordem: 0,
  status: "ativo",
  criadoEm: new Date(),
  atualizadoEm: new Date(),
};

const fakeAula = {
  id: "aula-uuid-1",
  titulo: "Aula 1",
  descricao: null,
  videoUrl: null,
  materialUrl: null,
  thumbnailUrl: null,
  duracaoMinutos: 30,
  tipoConteudo: "video",
  status: "rascunho",
  moduloId: "modulo-uuid-1",
  ordem: 0,
  criadoEm: new Date(),
  atualizadoEm: new Date(),
  criadoPor: "admin-1",
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("cursos.service", () => {
  beforeEach(() => {
    selectQueue.length = 0;
    insertIdResult = "new-id";
    updateCalled = false;
    deleteCalled = false;
  });

  // ── getCursoById ────────────────────────────────────────────────────────────

  describe("getCursoById", () => {
    it("returns curso when found", async () => {
      selectQueue.push([fakeCurso]);
      expect(await getCursoById("curso-uuid-1")).toMatchObject({ id: "curso-uuid-1" });
    });

    it("returns null when not found", async () => {
      selectQueue.push([]);
      expect(await getCursoById("missing")).toBeNull();
    });
  });

  // ── listCursos ──────────────────────────────────────────────────────────────

  describe("listCursos", () => {
    it("returns all cursos ordered by titulo", async () => {
      selectQueue.push([fakeCurso]);
      const result = await listCursos();
      expect(result).toHaveLength(1);
    });

    it("returns empty array when no cursos exist", async () => {
      selectQueue.push([]);
      expect(await listCursos()).toHaveLength(0);
    });
  });

  // ── createCurso ─────────────────────────────────────────────────────────────

  describe("createCurso", () => {
    it("creates and returns the new curso", async () => {
      insertIdResult = "new-curso-id";
      selectQueue.push([{ ...fakeCurso, id: "new-curso-id" }]); // getById after insert

      const result = await createCurso({ titulo: "React Avançado" }, "admin-1");

      expect(result.id).toBe("new-curso-id");
      expect(result.titulo).toBe("React Avançado");
    });
  });

  // ── updateCurso ─────────────────────────────────────────────────────────────

  describe("updateCurso", () => {
    it("updates and returns the updated curso", async () => {
      selectQueue.push([fakeCurso]); // existence check
      selectQueue.push([{ ...fakeCurso, titulo: "React Expert" }]); // return updated

      const result = await updateCurso("curso-uuid-1", { titulo: "React Expert" });

      expect(updateCalled).toBe(true);
      expect(result.titulo).toBe("React Expert");
    });

    it("throws CursoNotFoundError when not found", async () => {
      selectQueue.push([]);
      await expect(updateCurso("missing", { titulo: "X" })).rejects.toThrow(CursoNotFoundError);
    });
  });

  // ── deleteCurso ─────────────────────────────────────────────────────────────

  describe("deleteCurso", () => {
    it("deletes curso with no modules", async () => {
      selectQueue.push([fakeCurso]); // existence check
      selectQueue.push([]); // has modules check → none

      await deleteCurso("curso-uuid-1");

      expect(deleteCalled).toBe(true);
    });

    it("throws CursoNotFoundError when not found", async () => {
      selectQueue.push([]);
      await expect(deleteCurso("missing")).rejects.toThrow(CursoNotFoundError);
    });

    it("throws CursoHasModulosError when modules exist", async () => {
      selectQueue.push([fakeCurso]); // exists
      selectQueue.push([{ id: "mod-1" }]); // has modules

      await expect(deleteCurso("curso-uuid-1")).rejects.toThrow(CursoHasModulosError);
    });
  });

  // ── getModuloById ───────────────────────────────────────────────────────────

  describe("getModuloById", () => {
    it("returns modulo when found", async () => {
      selectQueue.push([fakeModulo]);
      expect(await getModuloById("modulo-uuid-1")).toMatchObject({ id: "modulo-uuid-1" });
    });

    it("returns null when not found", async () => {
      selectQueue.push([]);
      expect(await getModuloById("missing")).toBeNull();
    });
  });

  // ── listModulosByCurso ──────────────────────────────────────────────────────

  describe("listModulosByCurso", () => {
    it("returns modules ordered by ordem", async () => {
      selectQueue.push([fakeModulo]);
      const result = await listModulosByCurso("curso-uuid-1");
      expect(result).toHaveLength(1);
      expect(result[0]?.cursoId).toBe("curso-uuid-1");
    });
  });

  // ── createModulo ────────────────────────────────────────────────────────────

  describe("createModulo", () => {
    it("creates and returns the new modulo", async () => {
      insertIdResult = "new-modulo-id";
      selectQueue.push([fakeCurso]); // curso exists check
      selectQueue.push([{ ...fakeModulo, id: "new-modulo-id" }]); // getById after insert

      const result = await createModulo("curso-uuid-1", { titulo: "Módulo 1" });

      expect(result.id).toBe("new-modulo-id");
      expect(result.cursoId).toBe("curso-uuid-1");
    });

    it("throws CursoNotFoundError when curso does not exist", async () => {
      selectQueue.push([]); // curso not found
      await expect(createModulo("missing-curso", { titulo: "M" })).rejects.toThrow(
        CursoNotFoundError,
      );
    });
  });

  // ── updateModulo ────────────────────────────────────────────────────────────

  describe("updateModulo", () => {
    it("updates and returns the updated modulo", async () => {
      selectQueue.push([fakeModulo]); // existence check
      selectQueue.push([{ ...fakeModulo, titulo: "Módulo Atualizado" }]); // return updated

      const result = await updateModulo("modulo-uuid-1", { titulo: "Módulo Atualizado" });

      expect(updateCalled).toBe(true);
      expect(result.titulo).toBe("Módulo Atualizado");
    });

    it("throws ModuloNotFoundError when not found", async () => {
      selectQueue.push([]);
      await expect(updateModulo("missing", { titulo: "X" })).rejects.toThrow(ModuloNotFoundError);
    });
  });

  // ── deleteModulo ────────────────────────────────────────────────────────────

  describe("deleteModulo", () => {
    it("deletes modulo with no aulas", async () => {
      selectQueue.push([fakeModulo]); // existence check
      selectQueue.push([]); // has aulas check → none

      await deleteModulo("modulo-uuid-1");

      expect(deleteCalled).toBe(true);
    });

    it("throws ModuloNotFoundError when not found", async () => {
      selectQueue.push([]);
      await expect(deleteModulo("missing")).rejects.toThrow(ModuloNotFoundError);
    });

    it("throws ModuloHasAulasError when aulas exist", async () => {
      selectQueue.push([fakeModulo]); // exists
      selectQueue.push([{ id: "aula-1" }]); // has aulas

      await expect(deleteModulo("modulo-uuid-1")).rejects.toThrow(ModuloHasAulasError);
    });
  });

  // ── createAula ──────────────────────────────────────────────────────────────

  describe("createAula", () => {
    it("creates and returns the new aula", async () => {
      insertIdResult = "new-aula-id";
      selectQueue.push([fakeModulo]); // modulo exists check
      selectQueue.push([{ ...fakeAula, id: "new-aula-id" }]); // getById after insert

      const result = await createAula("modulo-uuid-1", { titulo: "Aula 1" }, "admin-1");

      expect(result.id).toBe("new-aula-id");
      expect(result.moduloId).toBe("modulo-uuid-1");
    });

    it("throws ModuloNotFoundError when modulo does not exist", async () => {
      selectQueue.push([]); // modulo not found
      await expect(createAula("missing-modulo", { titulo: "A" }, "admin-1")).rejects.toThrow(
        ModuloNotFoundError,
      );
    });
  });

  // ── listAulasByModulo ───────────────────────────────────────────────────────

  describe("listAulasByModulo", () => {
    it("returns aulas ordered by ordem", async () => {
      selectQueue.push([fakeAula]);
      const result = await listAulasByModulo("modulo-uuid-1");
      expect(result).toHaveLength(1);
      expect(result[0]?.moduloId).toBe("modulo-uuid-1");
    });
  });

  // ── updateAula ──────────────────────────────────────────────────────────────

  describe("updateAula", () => {
    it("updates and returns the updated aula", async () => {
      selectQueue.push([fakeAula]); // existence check
      selectQueue.push([{ ...fakeAula, titulo: "Aula Atualizada" }]); // return updated

      const result = await updateAula("aula-uuid-1", { titulo: "Aula Atualizada" });

      expect(updateCalled).toBe(true);
      expect(result.titulo).toBe("Aula Atualizada");
    });

    it("throws AulaNotFoundError when not found", async () => {
      selectQueue.push([]);
      await expect(updateAula("missing", { titulo: "X" })).rejects.toThrow(AulaNotFoundError);
    });
  });

  // ── deleteAula ──────────────────────────────────────────────────────────────

  describe("deleteAula", () => {
    it("deletes aula when found", async () => {
      selectQueue.push([fakeAula]);
      await deleteAula("aula-uuid-1");
      expect(deleteCalled).toBe(true);
    });

    it("throws AulaNotFoundError when not found", async () => {
      selectQueue.push([]);
      await expect(deleteAula("missing")).rejects.toThrow(AulaNotFoundError);
    });
  });
});
