import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  inviteAdminUserApi,
  sendAdminPasswordResetApi,
  setAdminUserStatusApi,
  updateAdminUserGroupsApi,
} from "./admin-users.api";

describe("admin-users.api", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
    vi.stubEnv("VITE_API_URL", "http://localhost:3001");
    localStorage.setItem("cms.accessToken", "token-admin");
  });

  it("invites admin with backend payload", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 201, json: async () => ({ id: "u1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await inviteAdminUserApi({ nome: "Ana", email: "ana@x.com" });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/admin/usuarios");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ nome: "Ana", email: "ana@x.com" }));
  });

  it("updates groups by admin id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "u1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await updateAdminUserGroupsApi({
      usuario_admin_id: "u1",
      grupos: [{ grupo_id: "g1", acesso_global: true, ambiente_id: null }],
    });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/admin/usuarios/u1/grupos");
    expect(options.method).toBe("PATCH");
  });

  it("sends reset by admin id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ message: "ok" }) });
    vi.stubGlobal("fetch", fetchMock);

    await sendAdminPasswordResetApi({ usuario_admin_id: "u1" });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/admin/usuarios/u1/reset-password");
    expect(options.method).toBe("POST");
  });

  it("sets status by admin id", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ id: "u1" }) });
    vi.stubGlobal("fetch", fetchMock);

    await setAdminUserStatusApi({ usuario_admin_id: "u1", status: "inativo" });

    const [url, options] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://localhost:3001/admin/usuarios/u1/status");
    expect(options.method).toBe("PATCH");
  });
});
