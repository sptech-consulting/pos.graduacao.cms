import { beforeEach, describe, expect, it, vi } from "vitest";
import { checkAlunoAmbienteAccessApi, ensureAlunoAuthLinkApi, listAlunoAmbientesApi } from "./aluno.api";

describe("aluno.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
    localStorage.setItem("cms.accessToken", "token-aluno");
  });

  it("loads aluno auth link compatibility payload from auth/me", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "a1", nomeCompleto: "Ana", emailAcesso: "ana@x.com", status: "ativo", role: "aluno" }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await ensureAlunoAuthLinkApi();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3001/auth/me");
    expect(result?.id).toBe("a1");
  });

  it("checks aluno ambiente access with bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    const result = await checkAlunoAmbienteAccessApi("ia");

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3001/aluno/ambientes/ia/access");
    expect(result).toEqual({ ok: true });
  });

  it("lists ambientes do aluno", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ aluno: null, ambientes: [] }) });
    vi.stubGlobal("fetch", fetchMock);

    await listAlunoAmbientesApi();

    expect(fetchMock.mock.calls[0]?.[0]).toBe("http://localhost:3001/aluno/me/ambientes");
  });
});
