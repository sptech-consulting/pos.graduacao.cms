import { createServerFn } from "@tanstack/react-start";
import { getAmbienteBrandingApi } from "./ambiente.api";

export const getAmbienteBranding = createServerFn({ method: "GET" })
  .inputValidator((input: { slug: string }) => {
    if (!input?.slug || typeof input.slug !== "string" || input.slug.length > 120) {
      throw new Error("slug inválido");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const row = await getAmbienteBrandingApi(data.slug);
    if (!row) return null;

    const mapped = {
      id: row.id,
      nome: row.nome,
      slug: row.slug,
      status: row.status,
      tema: row.tema,
      logo_url: row.logoUrl,
      imagem_login_url: row.imagemLoginUrl,
      cor_primaria: row.corPrimaria,
      cor_secundaria: row.corSecundaria,
      cor_fundo: row.corFundo,
      cor_texto: row.corTexto,
      cor_botao: row.corBotao,
      cor_card: row.corCard,
      cor_borda: row.corBorda,
      efeito_card_tilt_3d: row.efeitoCardTilt3d,
      efeito_card_glow: row.efeitoCardGlow,
      efeito_card_scale: row.efeitoCardScale,
      efeito_botao_lift: row.efeitoBotaoLift,
      efeito_entrada_animada: row.efeitoEntradaAnimada,
      efeito_som_hover: row.efeitoSomHover,
      efeito_som_volume: row.efeitoSomVolume,
      efeito_blobs_fundo: row.efeitoBlobsFundo,
    };

    return row.inativo ? { ...mapped, _inativo: true as const } : mapped;
  });
