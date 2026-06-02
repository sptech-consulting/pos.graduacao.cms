import { beforeEach, describe, expect, it, vi } from "vitest";
import { apiRequest, ApiClientError } from "./api-client";

describe("apiRequest", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
  });

  it("sends JSON with credentials and default method", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ ok: boolean }>("/auth/me");

    expect(fetchMock).toHaveBeenCalledWith("http://localhost:3001/auth/me", {
      method: "GET",
      credentials: "include",
      headers: expect.any(Headers),
      body: undefined,
    });
  });

  it("adds Authorization header when token is provided", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ accessToken: "ok" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await apiRequest<{ accessToken: string }>("/auth/refresh", { method: "POST", token: "abc" });

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    const headers = options.headers as Headers;
    expect(headers.get("Authorization")).toBe("Bearer abc");
  });

  it("throws ApiClientError with API message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ message: "Token expirado." }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(apiRequest("/auth/me")).rejects.toEqual(new ApiClientError(401, "Token expirado."));
  });
});
