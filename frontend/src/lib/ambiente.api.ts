import { apiRequest } from "./api-client";

type BackendAmbienteBrandingResponse = {
  id: string;
  nome: string;
  slug: string;
  status: "ativo" | "inativo" | "rascunho" | "arquivado";
  tema: "claro" | "escuro" | "personalizado";
  logoUrl: string | null;
  imagemLoginUrl: string | null;
  corPrimaria: string | null;
  corSecundaria: string | null;
  corFundo: string | null;
  corTexto: string | null;
  corBotao: string | null;
  corCard: string | null;
  corBorda: string | null;
  efeitoCardTilt3d: boolean;
  efeitoCardGlow: boolean;
  efeitoCardScale: boolean;
  efeitoBotaoLift: boolean;
  efeitoEntradaAnimada: boolean;
  efeitoSomHover: boolean;
  efeitoSomVolume: number;
  efeitoBlobsFundo: boolean;
  inativo?: true;
} | null;

export async function getAmbienteBrandingApi(slug: string): Promise<BackendAmbienteBrandingResponse> {
  return apiRequest<BackendAmbienteBrandingResponse>(`/ambientes/${encodeURIComponent(slug)}/branding`, {
    method: "GET",
  });
}
