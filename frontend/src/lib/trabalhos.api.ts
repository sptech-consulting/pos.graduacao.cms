import { apiRequest } from "./api-client";
import { isUuid } from "./slug";

type AmbientePublicoResponse = {
  ambienteId: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
  corFundo: string | null;
  corTexto: string | null;
};

type TrabalhoPublicoResponse = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  resumo: string | null;
  conteudo: string | null;
  autorNome: string;
  turma: string | null;
  imagemCapaUrl: string | null;
  linkExterno: string | null;
  tags: string[] | null;
  publicadoEm: string | null;
  ambienteNome: string;
  ambienteSlug: string;
  apresentacaoTipo: "video" | "pptx" | "imagem" | "documento" | "link" | null;
  apresentacaoUrl: string | null;
  apresentacaoTitulo: string | null;
  apresentacaoDescricao: string | null;
  apresentacaoImagemUrl: string | null;
  aplicacaoExpectativa: string | null;
  ordem: number;
  funcionalidades: Array<{
    id: string;
    ordem: number;
    titulo: string;
    descricao: string | null;
    imagemUrl: string | null;
  }>;
  links: Array<{
    id: string;
    ordem: number;
    rotulo: string;
    url: string;
    iconeUrl: string | null;
  }>;
};

function normalizeCodigo(codigo: string): string {
  return codigo.toUpperCase().replace(/\s+/g, "");
}

export async function resolvePublicAmbienteByCodeApi(codigo: string): Promise<AmbientePublicoResponse> {
  const value = normalizeCodigo(codigo);
  return apiRequest<AmbientePublicoResponse>(`/trabalhos/ambiente?codigo=${encodeURIComponent(value)}`);
}

export async function listPublicTrabalhosApi(ambienteId: string) {
  return apiRequest<TrabalhoPublicoResponse[]>(`/trabalhos?ambienteId=${encodeURIComponent(ambienteId)}`);
}

export async function getPublicTrabalhoApi(ambienteId: string, trabalhoId: string) {
  if (!isUuid(trabalhoId)) {
    throw new Error("Trabalho não encontrado.");
  }

  return apiRequest<TrabalhoPublicoResponse>(
    `/trabalhos/${encodeURIComponent(trabalhoId)}?ambienteId=${encodeURIComponent(ambienteId)}`,
  );
}
