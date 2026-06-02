import { beforeEach, describe, expect, it, vi } from "vitest";
import { getNovidadeDetalheApi } from "./novidade.api";

describe("novidade.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
  });

  it("loads novidade detalhe with bearer token", async () => {
    localStorage.setItem("cms.accessToken", "token-aluno");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "n1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await getNovidadeDetalheApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/aluno/ambientes/ia/novidades/a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-aluno");
  });

  it("throws when access token is missing", async () => {
    await expect(getNovidadeDetalheApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890")).rejects.toThrow(
      "Sessao expirada. Faca login novamente.",
    );
  });
});
