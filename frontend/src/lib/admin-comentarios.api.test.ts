import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAdminMetricasApi,
  listarComentariosAdminApi,
  listarLogsAuditoriaApi,
  moderarComentarioApi,
} from "./admin-comentarios.api";

describe("admin-comentarios.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
    localStorage.setItem("cms.accessToken", "token-admin");
  });

  it("lists comentarios with query params", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal("fetch", fetchMock);

    await listarComentariosAdminApi({ status: "ativo", busca: "abc" });

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3001/admin/comentarios?status=ativo&busca=abc");
  });

  it("moderates comentario with patch payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await moderarComentarioApi({ comentarioId: "a1b2c3d4-e5f6-7890-abcd-ef1234567890", status: "oculto" });

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/admin/comentarios/a1b2c3d4-e5f6-7890-abcd-ef1234567890/status");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ status: "oculto" }));
  });

  it("lists logs and metricas", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ totais: {} }) });
    vi.stubGlobal("fetch", fetchMock);

    await listarLogsAuditoriaApi({ acao: "comentario", limit: 10 });
    await getAdminMetricasApi();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3001/admin/logs?acao=comentario&limit=10");
    expect(fetchMock.mock.calls[1]?.[0]).toBe("http://localhost:3001/admin/metricas");
  });
});
