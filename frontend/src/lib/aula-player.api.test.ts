import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getAulaPlayerApi,
  marcarAulaConcluidaApi,
  postarComentarioApi,
  removerComentarioApi,
  salvarProgressoVideoApi,
  toggleCurtidaComentarioApi,
} from "./aula-player.api";

describe("aula-player.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
    localStorage.setItem("cms.accessToken", "token-aluno");
  });

  it("loads player payload with bearer token", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ aula: {} }) });
    vi.stubGlobal("fetch", fetchMock);

    await getAulaPlayerApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/aluno/ambientes/ia/aulas/a1b2c3d4-e5f6-7890-abcd-ef1234567890/player");
    expect((options.headers as Headers).get("Authorization")).toBe("Bearer token-aluno");
  });

  it("posts conclusao and progresso payloads", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await marcarAulaConcluidaApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890", true);
    await salvarProgressoVideoApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890", 33, false);

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/conclusao");
    expect(fetchMock.mock.calls[0]?.[1]?.body).toBe(JSON.stringify({ concluida: true }));
    expect(fetchMock.mock.calls[1]?.[0]).toContain("/progresso");
    expect(fetchMock.mock.calls[1]?.[1]?.body).toBe(JSON.stringify({ segundos: 33, concluida: false }));
  });

  it("posts, deletes and toggles comentario actions", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "c1", liked: true, ok: true }) });
    vi.stubGlobal("fetch", fetchMock);

    await postarComentarioApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "Teste", null);
    await removerComentarioApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "b2c3d4e5-f6a7-8901-bcde-f01234567891");
    await toggleCurtidaComentarioApi("ia", "a1b2c3d4-e5f6-7890-abcd-ef1234567890", "b2c3d4e5-f6a7-8901-bcde-f01234567891");

    expect(fetchMock.mock.calls[0]?.[0]).toContain("/comentarios");
    expect(fetchMock.mock.calls[1]?.[1]?.method).toBe("DELETE");
    expect(fetchMock.mock.calls[2]?.[0]).toContain("/curtida");
  });
});
