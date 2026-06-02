const DEFAULT_API_URL = "http://localhost:3001";

function normalizeApiBaseUrl(url: string): string {
  return url.endsWith("/") ? url.slice(0, -1) : url;
}

function resolveApiBaseUrl(): string {
  const envUrl = import.meta.env.VITE_API_URL;
  if (typeof envUrl !== "string" || envUrl.length === 0) {
    return DEFAULT_API_URL;
  }

  return normalizeApiBaseUrl(envUrl);
}

export class ApiClientError extends Error {
  readonly statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "ApiClientError";
    this.statusCode = statusCode;
  }
}

type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  token?: string;
  body?: unknown;
};

type ErrorPayload = {
  message?: string;
  error?: string;
};

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const apiBaseUrl = resolveApiBaseUrl();
  const headers = new Headers();

  headers.set("Content-Type", "application/json");
  if (options.token) {
    headers.set("Authorization", `Bearer ${options.token}`);
  }

  const response = await fetch(`${apiBaseUrl}${path}`, {
    method: options.method ?? "GET",
    credentials: "include",
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (response.status === 204) {
    return undefined as T;
  }

  const payload = (await response.json().catch(() => null)) as T | ErrorPayload | null;
  if (response.ok) {
    return (payload ?? {}) as T;
  }

  const fallbackMessage = `Request failed with status ${response.status}`;
  const message =
    typeof payload === "object" && payload !== null
      ? payload.message ?? payload.error ?? fallbackMessage
      : fallbackMessage;

  throw new ApiClientError(response.status, message);
}
