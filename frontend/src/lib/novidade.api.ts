import { readAccessToken } from "./backend-auth";
import { apiRequest } from "./api-client";

type BackendNovidadeDetalheResponse = {
  id: string;
  titulo: string;
  resumo: string | null;
  conteudo: string | null;
  imagemUrl: string | null;
  fonteUrl: string | null;
  fonteNome: string | null;
  categoria: string | null;
  publicadoEm: string | null;
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

export async function getNovidadeDetalheApi(slug: string, novidadeId: string): Promise<BackendNovidadeDetalheResponse> {
  const token = requireToken();
  return apiRequest<BackendNovidadeDetalheResponse>(
    `/aluno/ambientes/${encodeURIComponent(slug)}/novidades/${encodeURIComponent(novidadeId)}`,
    {
      method: "GET",
      token,
    },
  );
}
