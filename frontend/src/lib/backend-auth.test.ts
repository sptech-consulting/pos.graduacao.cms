import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearAccessToken,
  getApiUser,
  readAccessToken,
  requestApiPasswordReset,
  resetApiPassword,
  signInWithApi,
  signOutWithApi,
} from "./backend-auth";

function countAuthChangedEvents() {
  const events: Event[] = [];
  function handler(event: Event) {
    events.push(event);
  }

  window.addEventListener("auth:changed", handler);
  return {
    total: () => events.length,
    cleanup: () => window.removeEventListener("auth:changed", handler),
  };
}

describe("backend-auth", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
  });

  it("stores access token on login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ accessToken: "token-1" }) }),
    );

    await signInWithApi("admin@sptech.com", "12345678", "admin");

    expect(readAccessToken()).toBe("token-1");
  });

  it("returns null when refresh fails without token", async () => {
    const authEvents = countAuthChangedEvents();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ message: "unauthorized" }) }),
    );

    await expect(getApiUser()).resolves.toBeNull();
    expect(authEvents.total()).toBe(0);
    authEvents.cleanup();
  });

  it("logs out and clears token even when endpoint fails", async () => {
    localStorage.setItem("cms.accessToken", "token-2");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({ message: "boom" }) }),
    );

    await signOutWithApi();

    expect(readAccessToken()).toBeNull();
  });

  it("sends forgot password using backend role", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);

    await requestApiPasswordReset("aluno@sptech.com", "aluno");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBe(JSON.stringify({ email: "aluno@sptech.com", role: "aluno" }));
  });

  it("sends reset password token and new password", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);

    await resetApiPassword("a".repeat(64), "NewPass123!");

    const [, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(options.body).toBe(JSON.stringify({ token: "a".repeat(64), newPassword: "NewPass123!" }));
  });

  it("can clear token manually", () => {
    localStorage.setItem("cms.accessToken", "token-3");

    clearAccessToken();

    expect(readAccessToken()).toBeNull();
  });
});
