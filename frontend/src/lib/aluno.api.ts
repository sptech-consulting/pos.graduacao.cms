import { apiRequest, ApiClientError } from "./api-client";
import { readAccessToken } from "./backend-auth";

type BackendAlunoMeResponse = {
  id: string;
  nomeCompleto: string;
  emailAcesso: string;
  status: string;
  role: "aluno";
};

type BackendAlunoAccessResponse =
  | { ok: true }
  | { ok: false; reason: "no_aluno" | "not_found" | "inativo" | "no_link" };

type BackendAlunoAmbientesResponse = {
  aluno: { nomeCompleto: string; emailAcesso: string } | null;
  ambientes: Array<{ id: string; nome: string; slug: string; corPrimaria: string | null; imagemCapaUrl: string | null }>;
};

function requireToken(): string {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }
  return token;
}

export async function ensureAlunoAuthLinkApi() {
  const token = requireToken();
  try {
    const user = await apiRequest<BackendAlunoMeResponse | { role: "admin" }>("/auth/me", { token });
    if ((user as { role?: string }).role !== "aluno") return null;
    const aluno = user as BackendAlunoMeResponse;
    return {
      id: aluno.id,
      nomeCompleto: aluno.nomeCompleto,
      emailAcesso: aluno.emailAcesso,
      status: aluno.status,
      authUserId: aluno.id,
    };
  } catch (error) {
    if (error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 403)) {
      return null;
    }
    throw error;
  }
}

export async function checkAlunoAmbienteAccessApi(slug: string): Promise<BackendAlunoAccessResponse> {
  const token = requireToken();
  try {
    return await apiRequest<BackendAlunoAccessResponse>(`/aluno/ambientes/${encodeURIComponent(slug)}/access`, {
      method: "GET",
      token,
    });
  } catch (error) {
    if (error instanceof ApiClientError && (error.statusCode === 401 || error.statusCode === 403)) {
      return { ok: false, reason: "no_aluno" };
    }
    throw error;
  }
}

export async function listAlunoAmbientesApi(): Promise<BackendAlunoAmbientesResponse> {
  const token = requireToken();
  return apiRequest<BackendAlunoAmbientesResponse>("/aluno/me/ambientes", { method: "GET", token });
}
