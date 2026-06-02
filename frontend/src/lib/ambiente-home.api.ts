import { apiRequest } from "./api-client";
import { readAccessToken } from "./backend-auth";

type BackendAmbienteHomeResponse = {
  branding: {
    id: string;
    nome: string;
    slug: string;
    descricao: string | null;
    logoUrl: string | null;
    imagemCapaUrl: string | null;
    corPrimaria: string;
    corSecundaria: string;
    corFundo: string;
    corTexto: string;
    corBotao: string;
    corCard: string;
    corBorda: string;
    cardEstilo: "flat" | "sombra" | "borda" | "imagem";
    cardBorda: "quadrado" | "levemente_arredondado" | "arredondado" | "pill";
    cardTamanho: "compacto" | "medio" | "grande";
    cardSombra: boolean;
    cardExibirIcone: boolean;
    cardExibirImagem: boolean;
    efeitoCardTilt3d: boolean;
    efeitoCardGlow: boolean;
    efeitoCardScale: boolean;
    efeitoBotaoLift: boolean;
    efeitoEntradaAnimada: boolean;
    efeitoSomHover: boolean;
    efeitoSomVolume: number;
    efeitoBlobsFundo: boolean;
    tema: "claro" | "escuro";
    playbookTitulo: string | null;
    playbookDescricao: string | null;
    playbookCapaUrl: string | null;
    playbookArquivoUrl: string | null;
  };
  aluno: {
    id: string;
    nomeCompleto: string;
    emailAcesso: string;
  };
  ferramentas: Array<{
    id: string;
    slug: string | null;
    nome: string;
    descricao: string | null;
    url: string | null;
    iconeUrl: string | null;
    categoria: string | null;
    tipoAbertura: "nova_aba" | "mesma_aba" | "modal" | null;
    destaque: boolean;
  }>;
  novidades: Array<{
    id: string;
    slug: string | null;
    titulo: string;
    resumo: string | null;
    imagemUrl: string | null;
    fonteNome: string | null;
    fonteUrl: string | null;
    categoria: string | null;
    publicadoEm: string | null;
    destaque: boolean;
  }>;
  aulas: Array<{
    id: string;
    slug: string | null;
    titulo: string;
    descricao: string | null;
    modulo: string | null;
    videoUrl: string | null;
    materialUrl: string | null;
    thumbnailUrl: string | null;
    duracaoMinutos: number | null;
    tipoConteudo: string | null;
    moduloOrdem: number;
    ordem: number;
  }>;
  cursos: Array<{
    id: string;
    titulo: string;
    descricao: string | null;
    capaUrl: string | null;
    categoria: string | null;
    nivel: string | null;
    totalAulas: number;
    primeiraAulaId: string | null;
    primeiraAulaSlug: string | null;
    ordem: number;
    destaque: boolean;
  }>;
};

function requireToken(): string {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }

  return token;
}

export async function getAmbienteHomeApi(slug: string): Promise<BackendAmbienteHomeResponse> {
  const token = requireToken();
  return apiRequest<BackendAmbienteHomeResponse>(`/aluno/ambientes/${encodeURIComponent(slug)}/home`, {
    method: "GET",
    token,
  });
}
