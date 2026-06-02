import { beforeEach, describe, expect, it, vi } from "vitest";

const selectQueue: unknown[][] = [];
let updateCalled = false;

vi.mock("../db/connection.js", () => ({
  db: {
    select: () => ({
      from: () => ({
        then: (resolve: (value: unknown[]) => unknown) => resolve(selectQueue.shift() ?? []),
        where: () => ({
          limit: async () => selectQueue.shift() ?? [],
          then: (resolve: (value: unknown[]) => unknown) => resolve(selectQueue.shift() ?? []),
        }),
        orderBy: async () => selectQueue.shift() ?? [],
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => {
          updateCalled = true;
        },
      }),
    }),
  },
}));

const auditFns = vi.hoisted(() => ({ auditMock: vi.fn() }));
vi.mock("./audit.service.js", () => ({ audit: auditFns.auditMock }));

import {
  AdminComentarioNotFoundError,
  getAdminMetricas,
  listAdminComentarios,
  listAdminLogs,
  moderarComentarioAdmin,
} from "./admin-comentarios.service.js";

function reset() {
  selectQueue.length = 0;
  updateCalled = false;
  auditFns.auditMock.mockReset();
}

describe("admin-comentarios.service", () => {
  beforeEach(reset);

  it("lists admin comentarios with joined metadata", async () => {
    selectQueue.push([{ id: "c1", conteudo: "Oi", status: "ativo", criadoEm: new Date("2024-01-01"), ambienteId: "amb-1", aulaId: "a1", alunoId: "al-1", usuarioAdminId: null, parentId: null }]);
    selectQueue.push([{ id: "al-1", nomeCompleto: "Ana" }]);
    selectQueue.push([{ id: "amb-1", nome: "IA", slug: "ia" }]);
    selectQueue.push([{ id: "a1", titulo: "Aula 1" }]);
    selectQueue.push([{ comentarioId: "c1" }, { comentarioId: "c1" }]);

    const result = await listAdminComentarios({ status: "ativo" });

    expect(result).toHaveLength(1);
    expect(result[0]?.autorNome).toBe("Ana");
    expect(result[0]?.curtidas).toBe(2);
  });

  it("moderates comentario and writes audit", async () => {
    selectQueue.push([{ id: "c1", ambienteId: "amb-1", status: "ativo" }]);

    const result = await moderarComentarioAdmin({ comentarioId: "c1", status: "oculto", usuarioAdminId: "admin-1" });

    expect(result.ok).toBe(true);
    expect(updateCalled).toBe(true);
    expect(auditFns.auditMock).toHaveBeenCalled();
  });

  it("throws when comentario does not exist", async () => {
    selectQueue.push([]);
    await expect(moderarComentarioAdmin({ comentarioId: "missing", status: "removido", usuarioAdminId: "admin-1" })).rejects.toBeInstanceOf(AdminComentarioNotFoundError);
  });

  it("lists admin logs with ambiente and admin names", async () => {
    selectQueue.push([{ id: "l1", acao: "comentario", entidade: "aula_comentarios", entidadeId: "c1", ambienteId: "amb-1", usuarioAdminId: "ad-1", dadosNovos: {}, dadosAnteriores: {}, criadoEm: new Date("2024-01-02") }]);
    selectQueue.push([{ id: "amb-1", nome: "IA" }]);
    selectQueue.push([{ id: "ad-1", nome: "Admin" }]);

    const result = await listAdminLogs({ acao: "comentario", limit: 10 });

    expect(result[0]?.ambienteNome).toBe("IA");
    expect(result[0]?.usuarioAdminNome).toBe("Admin");
  });

  it("builds admin metricas payload", async () => {
    selectQueue.push([{ id: "amb-1" }]);
    selectQueue.push([{ id: "al-1" }]);
    selectQueue.push([{ id: "curso-1" }]);
    selectQueue.push([{ id: "a1", titulo: "Aula 1", moduloId: "m1" }]);
    selectQueue.push([{ id: "c1", criadoEm: new Date(), ambienteId: "amb-1" }]);
    selectQueue.push([{ aulaId: "a1", concluidaEm: new Date() }]);
    selectQueue.push([{ aulaId: "a1" }, { aulaId: "a1" }]);
    selectQueue.push([{ id: "m1", cursoId: "curso-1" }]);
    selectQueue.push([{ ambienteId: "amb-1", cursoId: "curso-1" }]);
    selectQueue.push([{ id: "amb-1", nome: "IA" }]);

    const result = await getAdminMetricas();

    expect(result.totais.ambientesAtivos).toBe(1);
    expect(result.aulasMaisAssistidas[0]?.visualizacoes).toBe(2);
    expect(result.ambientesMaisEngajados[0]?.nome).toBe("IA");
  });
});
