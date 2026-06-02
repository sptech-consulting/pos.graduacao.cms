import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublicTrabalhoApi,
  listPublicTrabalhosApi,
  resolvePublicAmbienteByCodeApi,
} from "./trabalhos.api";

describe("trabalhos.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
  });

  it("resolves ambiente by normalized codigo", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ambienteId: "amb-1" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await resolvePublicAmbienteByCodeApi("spt 2026");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/trabalhos/ambiente?codigo=SPT2026");
  });

  it("lists public trabalhos by ambienteId", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => [{ id: "t1" }],
    });
    vi.stubGlobal("fetch", fetchMock);

    await listPublicTrabalhosApi("amb-1");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/trabalhos?ambienteId=amb-1");
  });

  it("gets public trabalho by uuid", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "b2c3d4e5-f6a7-8901-bcde-f01234567891" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await getPublicTrabalhoApi("amb-1", "b2c3d4e5-f6a7-8901-bcde-f01234567891");

    const [url] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(
      "http://localhost:3001/trabalhos/b2c3d4e5-f6a7-8901-bcde-f01234567891?ambienteId=amb-1",
    );
  });

  it("rejects non-uuid trabalho id", async () => {
    await expect(getPublicTrabalhoApi("amb-1", "trabalho-slug")).rejects.toThrow(
      "Trabalho não encontrado.",
    );
  });
});
