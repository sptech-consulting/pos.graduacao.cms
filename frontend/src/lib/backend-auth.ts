import { apiRequest, ApiClientError } from "./api-client";

const ACCESS_TOKEN_KEY = "cms.accessToken";

export type AuthRole = "admin" | "aluno";

type LoginResponse = { accessToken: string };

type AdminMeResponse = {
  id: string;
  nome: string;
  email: string;
  status: string;
  role: "admin";
};

type AlunoMeResponse = {
  id: string;
  nomeCompleto: string;
  emailAcesso: string;
  status: string;
  role: "aluno";
};

export type BackendAuthUser = AdminMeResponse | AlunoMeResponse;

function readStorage(): Storage | null {
  if (typeof window === "undefined") {
    return null;
  }

  return window.localStorage;
}

export function readAccessToken(): string | null {
  return readStorage()?.getItem(ACCESS_TOKEN_KEY) ?? null;
}

export function storeAccessToken(token: string): void {
  readStorage()?.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAccessToken(): void {
  readStorage()?.removeItem(ACCESS_TOKEN_KEY);
}

function notifyAuthChanged(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new CustomEvent("auth:changed"));
}

function notifyAuthChangedWhenTokenChanges(previousToken: string | null, nextToken: string | null): void {
  if (previousToken === nextToken) {
    return;
  }

  notifyAuthChanged();
}

export async function signInWithApi(email: string, password: string, role: AuthRole): Promise<void> {
  const response = await apiRequest<LoginResponse>("/auth/login", {
    method: "POST",
    body: { email, password, role },
  });

  storeAccessToken(response.accessToken);
  notifyAuthChanged();
}

export async function refreshApiSession(): Promise<boolean> {
  const previousToken = readAccessToken();

  try {
    const response = await apiRequest<LoginResponse>("/auth/refresh", { method: "POST" });
    storeAccessToken(response.accessToken);
    notifyAuthChangedWhenTokenChanges(previousToken, response.accessToken);
    return true;
  } catch {
    clearAccessToken();
    notifyAuthChangedWhenTokenChanges(previousToken, null);
    return false;
  }
}

export async function signOutWithApi(): Promise<void> {
  const token = readAccessToken();
  try {
    await apiRequest<void>("/auth/logout", { method: "POST", token: token ?? undefined });
  } catch {
    // Keep local cleanup even when backend logout fails.
  } finally {
    clearAccessToken();
    notifyAuthChanged();
  }
}

async function getMeWithToken(token: string): Promise<BackendAuthUser | null> {
  try {
    return await apiRequest<BackendAuthUser>("/auth/me", { token });
  } catch (error) {
    if (error instanceof ApiClientError && error.statusCode === 401) {
      return null;
    }

    throw error;
  }
}

export async function getApiUser(): Promise<BackendAuthUser | null> {
  const currentToken = readAccessToken();
  if (!currentToken) {
    const refreshed = await refreshApiSession();
    if (!refreshed) {
      return null;
    }
  }

  const activeToken = readAccessToken();
  if (!activeToken) {
    return null;
  }

  const user = await getMeWithToken(activeToken);
  if (user) {
    return user;
  }

  const refreshed = await refreshApiSession();
  if (!refreshed) {
    return null;
  }

  const nextToken = readAccessToken();
  if (!nextToken) {
    return null;
  }

  return getMeWithToken(nextToken);
}

export async function requestApiPasswordReset(email: string, role: AuthRole): Promise<void> {
  await apiRequest<{ message: string }>("/auth/forgot-password", {
    method: "POST",
    body: { email, role },
  });
}

export async function resetApiPassword(token: string, newPassword: string): Promise<void> {
  await apiRequest<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: { token, newPassword },
  });
}
