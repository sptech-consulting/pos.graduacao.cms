import { apiRequest } from "./api-client";
import { readAccessToken } from "./backend-auth";

type ComentarioStatus = "ativo" | "oculto" | "removido";

export type BackendAdminComentarioRow = {
  id: string;
  conteudo: string;
  status: string;
  criadoEm: string;
  ambienteId: string;
  ambienteNome: string;
  ambienteSlug: string;
  aulaId: string;
  aulaTitulo: string;
  autorNome: string;
  autorTipo: "aluno" | "admin";
  parentId: string | null;
  curtidas: number;
};

export type BackendAdminLogRow = {
  id: string;
  acao: string;
  entidade: string | null;
  entidadeId: string | null;
  ambienteId: string | null;
  ambienteNome: string | null;
  usuarioAdminId: string | null;
  usuarioAdminNome: string | null;
  dadosNovos: unknown;
  dadosAnteriores: unknown;
  criadoEm: string;
};

export type BackendAdminMetricas = {
  totais: {
    ambientesAtivos: number;
    alunosAtivos: number;
    cursosPublicados: number;
    aulasPublicadas: number;
    comentarios30d: number;
    aulasConcluidas30d: number;
  };
  aulasMaisAssistidas: { id: string; titulo: string; visualizacoes: number }[];
  comentariosPorDia: { data: string; total: number }[];
  ambientesMaisEngajados: { id: string; nome: string; comentarios: number; conclusoes: number }[];
};

function requireToken(): string {
  const token = readAccessToken();
  if (!token) throw new Error("Sessao expirada. Faca login novamente.");
  return token;
}

export async function listarComentariosAdminApi(filters: { status?: string; ambienteId?: string; busca?: string }) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.ambienteId) params.set("ambienteId", filters.ambienteId);
  if (filters.busca) params.set("busca", filters.busca);
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<BackendAdminComentarioRow[]>(`/admin/comentarios${suffix}`, { method: "GET", token: requireToken() });
}

export async function moderarComentarioApi(payload: { comentarioId: string; status: ComentarioStatus }) {
  return apiRequest<{ ok: true }>(`/admin/comentarios/${encodeURIComponent(payload.comentarioId)}/status`, {
    method: "PATCH",
    token: requireToken(),
    body: { status: payload.status },
  });
}

export async function listarLogsAuditoriaApi(filters: { acao?: string; ambienteId?: string; limit?: number }) {
  const params = new URLSearchParams();
  if (filters.acao) params.set("acao", filters.acao);
  if (filters.ambienteId) params.set("ambienteId", filters.ambienteId);
  if (typeof filters.limit === "number") params.set("limit", String(filters.limit));
  const suffix = params.toString() ? `?${params.toString()}` : "";
  return apiRequest<BackendAdminLogRow[]>(`/admin/logs${suffix}`, { method: "GET", token: requireToken() });
}

export async function getAdminMetricasApi() {
  return apiRequest<BackendAdminMetricas>("/admin/metricas", { method: "GET", token: requireToken() });
}
