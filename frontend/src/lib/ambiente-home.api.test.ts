import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAmbienteHomeApi } from "./ambiente-home.api";

describe("ambiente-home.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
  });

  it("loads aluno home payload with bearer token", async () => {
    localStorage.setItem("cms.accessToken", "token-aluno");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ branding: {} }) });
    vi.stubGlobal("fetch", fetchMock);

    await getAmbienteHomeApi("ia");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/aluno/ambientes/ia/home");
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-aluno");
  });

  it("throws when access token is missing", async () => {
    await expect(getAmbienteHomeApi("ia")).rejects.toThrow("Sessao expirada. Faca login novamente.");
  });
});
