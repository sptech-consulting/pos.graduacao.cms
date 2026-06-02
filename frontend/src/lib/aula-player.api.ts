import { readAccessToken } from "./backend-auth";
import { apiRequest } from "./api-client";

export type BackendAulaPlayerResponse = {
  branding: {
    id: string;
    slug: string;
    nome: string;
    logoUrl: string | null;
    corPrimaria: string;
    corSecundaria: string;
    corFundo: string;
    corTexto: string;
    corBotao: string;
    corCard: string;
    corBorda: string;
    tema: "claro" | "escuro";
  };
  aluno: { id: string; nomeCompleto: string };
  curso: { id: string; titulo: string };
  moduloAtual: { id: string; titulo: string };
  aula: {
    id: string;
    titulo: string;
    descricao: string | null;
    videoUrl: string | null;
    materialUrl: string | null;
    duracaoMinutos: number | null;
    tipoConteudo: string | null;
    concluida: boolean;
    segundosAssistidos: number;
  };
  proximaAulaId: string | null;
  proximaAulaTitulo: string | null;
  modulos: Array<{ id: string; titulo: string; ordem: number; aulas: Array<{ id: string; titulo: string; ordem: number; duracaoMinutos: number | null; concluida: boolean }> }>;
  recomendados: Array<{ cursoId: string; titulo: string; capaUrl: string | null; primeiraAulaId: string | null; totalAulas: number }>;
  comentarios: Array<{ id: string; parentId: string | null; conteudo: string; criadoEm: string; autorNome: string; autorTipo: "aluno" | "admin"; autorId: string; curtidas: number; likedByMe: boolean; isMine: boolean }>;
};

function requireToken(): string {
  const token = readAccessToken();
  if (!token) throw new Error("Sessao expirada. Faca login novamente.");
  return token;
}

function basePath(slug: string, aulaId: string): string {
  return `/aluno/ambientes/${encodeURIComponent(slug)}/aulas/${encodeURIComponent(aulaId)}`;
}

export async function getAulaPlayerApi(slug: string, aulaId: string): Promise<BackendAulaPlayerResponse> {
  return apiRequest<BackendAulaPlayerResponse>(`${basePath(slug, aulaId)}/player`, { method: "GET", token: requireToken() });
}

export async function marcarAulaConcluidaApi(slug: string, aulaId: string, concluida: boolean) {
  return apiRequest<{ ok: true }>(`${basePath(slug, aulaId)}/conclusao`, { method: "POST", token: requireToken(), body: { concluida } });
}

export async function salvarProgressoVideoApi(slug: string, aulaId: string, segundos: number, concluida?: boolean) {
  return apiRequest<{ ok: true }>(`${basePath(slug, aulaId)}/progresso`, { method: "POST", token: requireToken(), body: { segundos, ...(typeof concluida === "boolean" ? { concluida } : {}) } });
}

export async function postarComentarioApi(slug: string, aulaId: string, conteudo: string, parentId?: string | null) {
  return apiRequest<{ id: string }>(`${basePath(slug, aulaId)}/comentarios`, { method: "POST", token: requireToken(), body: { conteudo, ...(typeof parentId !== "undefined" ? { parentId } : {}) } });
}

export async function removerComentarioApi(slug: string, aulaId: string, comentarioId: string) {
  return apiRequest<{ ok: true }>(`${basePath(slug, aulaId)}/comentarios/${encodeURIComponent(comentarioId)}`, { method: "DELETE", token: requireToken() });
}

export async function toggleCurtidaComentarioApi(slug: string, aulaId: string, comentarioId: string) {
  return apiRequest<{ liked: boolean }>(`${basePath(slug, aulaId)}/comentarios/${encodeURIComponent(comentarioId)}/curtida`, { method: "POST", token: requireToken() });
}
