import { beforeEach, describe, expect, it, vi } from "vitest";
import { getAmbienteBrandingApi } from "./ambiente.api";

describe("ambiente.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
  });

  it("loads public ambiente branding without auth", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ slug: "ia" }) });
    vi.stubGlobal("fetch", fetchMock);

    await getAmbienteBrandingApi("ia");

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/ambientes/ia/branding");
    expect(options.method).toBe("GET");
  });
});
