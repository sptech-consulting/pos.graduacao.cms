import { beforeEach, describe, expect, it, vi } from "vitest";
import { getFerramentaDetalheApi } from "./ferramenta.api";

describe("ferramenta.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
  });

  it("loads ferramenta detalhe with bearer token", async () => {
    localStorage.setItem("cms.accessToken", "token-aluno");
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "f1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await getFerramentaDetalheApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/aluno/ambientes/ia/ferramentas/a1b2c3d4-e5f6-7890-abcd-ef1234567890");
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer token-aluno");
  });

  it("throws when access token is missing", async () => {
    await expect(getFerramentaDetalheApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890")).rejects.toThrow(
      "Sessao expirada. Faca login novamente.",
    );
  });
});
