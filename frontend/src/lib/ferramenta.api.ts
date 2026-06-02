import { readAccessToken } from "./backend-auth";
import { apiRequest } from "./api-client";

type BackendFerramentaDetalheResponse = {
  id: string;
  nome: string;
  descricao: string | null;
  subtitulo: string | null;
  descricaoLonga: string | null;
  url: string | null;
  iconeUrl: string | null;
  imagemCapaUrl: string | null;
  categoria: string | null;
  tipoAbertura: "nova_aba" | "mesma_aba" | "modal" | null;
  fraseDestaque: string | null;
  casosUso: Array<{ id: string; texto: string }>;
  tags: Array<{ id: string; tipo: "input" | "output" | "integracao"; rotulo: string }>;
  blocos: Array<{ id: string; titulo: string; conteudo: string }>;
  funcionalidades: Array<{ id: string; titulo: string; descricao: string | null; imagemUrl: string | null }>;
  casosTeste: Array<{
    id: string;
    titulo: string;
    badge: string | null;
    promptExemplo: string | null;
    explicacao: string | null;
  }>;
  ambienteSlug: string;
  ambienteNome: string;
};

function requireToken(): string {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }

  return token;
}

export async function getFerramentaDetalheApi(
  slug: string,
  ferramentaId: string,
): Promise<BackendFerramentaDetalheResponse> {
  const token = requireToken();
  return apiRequest<BackendFerramentaDetalheResponse>(
    `/aluno/ambientes/${encodeURIComponent(slug)}/ferramentas/${encodeURIComponent(ferramentaId)}`,
    {
      method: "GET",
      token,
    },
  );
}
