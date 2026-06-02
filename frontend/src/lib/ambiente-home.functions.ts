import { createServerFn } from "@tanstack/react-start";
import { getAmbienteHomeApi } from "./ambiente-home.api";

export type AmbienteHomeBranding = {
  id: string;
  nome: string;
  slug: string;
  descricao: string | null;
  logo_url: string | null;
  imagem_capa_url: string | null;
  cor_primaria: string;
  cor_secundaria: string;
  cor_fundo: string;
  cor_texto: string;
  cor_botao: string;
  cor_card: string;
  cor_borda: string;
  card_estilo: "flat" | "sombra" | "borda" | "imagem";
  card_borda: "quadrado" | "levemente_arredondado" | "arredondado" | "pill";
  card_tamanho: "compacto" | "medio" | "grande";
  card_sombra: boolean;
  card_exibir_icone: boolean;
  card_exibir_imagem: boolean;
  efeito_card_tilt_3d: boolean;
  efeito_card_glow: boolean;
  efeito_card_scale: boolean;
  efeito_botao_lift: boolean;
  efeito_entrada_animada: boolean;
  efeito_som_hover: boolean;
  efeito_som_volume: number;
  efeito_blobs_fundo: boolean;
  tema: "claro" | "escuro";
  playbook_titulo: string | null;
  playbook_descricao: string | null;
  playbook_capa_url: string | null;
  playbook_arquivo_url: string | null;
};

export type FerramentaItem = {
  id: string;
  slug: string | null;
  nome: string;
  descricao: string | null;
  url: string | null;
  icone_url: string | null;
  categoria: string | null;
  tipo_abertura: "nova_aba" | "mesma_aba" | "modal" | null;
  destaque: boolean;
};

export type NovidadeItem = {
  id: string;
  slug: string | null;
  titulo: string;
  resumo: string | null;
  imagem_url: string | null;
  fonte_nome: string | null;
  fonte_url: string | null;
  categoria: string | null;
  publicado_em: string | null;
  destaque: boolean;
};

export type AulaItem = {
  id: string;
  slug: string | null;
  titulo: string;
  descricao: string | null;
  modulo: string | null;
  video_url: string | null;
  material_url: string | null;
  thumbnail_url: string | null;
  duracao_minutos: number | null;
  tipo_conteudo: string | null;
  modulo_ordem: number;
  ordem: number;
};

export type CursoItem = {
  id: string;
  titulo: string;
  descricao: string | null;
  capa_url: string | null;
  categoria: string | null;
  nivel: string | null;
  total_aulas: number;
  primeira_aula_id: string | null;
  primeira_aula_slug: string | null;
  ordem: number;
  destaque: boolean;
};

export type AmbienteHomeData = {
  branding: AmbienteHomeBranding;
  aluno: { id: string; nome_completo: string; email_acesso: string };
  ferramentas: FerramentaItem[];
  novidades: NovidadeItem[];
  aulas: AulaItem[];
  cursos: CursoItem[];
};

export const getAmbienteHome = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string }) => {
    if (!input?.slug || typeof input.slug !== "string" || input.slug.length > 120) {
      throw new Error("slug inválido");
    }

    return input;
  })
  .handler(async ({ data }): Promise<AmbienteHomeData> => {
    const payload = await getAmbienteHomeApi(data.slug);
    return {
      branding: {
        id: payload.branding.id,
        nome: payload.branding.nome,
        slug: payload.branding.slug,
        descricao: payload.branding.descricao,
        logo_url: payload.branding.logoUrl,
        imagem_capa_url: payload.branding.imagemCapaUrl,
        cor_primaria: payload.branding.corPrimaria,
        cor_secundaria: payload.branding.corSecundaria,
        cor_fundo: payload.branding.corFundo,
        cor_texto: payload.branding.corTexto,
        cor_botao: payload.branding.corBotao,
        cor_card: payload.branding.corCard,
        cor_borda: payload.branding.corBorda,
        card_estilo: payload.branding.cardEstilo,
        card_borda: payload.branding.cardBorda,
        card_tamanho: payload.branding.cardTamanho,
        card_sombra: payload.branding.cardSombra,
        card_exibir_icone: payload.branding.cardExibirIcone,
        card_exibir_imagem: payload.branding.cardExibirImagem,
        efeito_card_tilt_3d: payload.branding.efeitoCardTilt3d,
        efeito_card_glow: payload.branding.efeitoCardGlow,
        efeito_card_scale: payload.branding.efeitoCardScale,
        efeito_botao_lift: payload.branding.efeitoBotaoLift,
        efeito_entrada_animada: payload.branding.efeitoEntradaAnimada,
        efeito_som_hover: payload.branding.efeitoSomHover,
        efeito_som_volume: payload.branding.efeitoSomVolume,
        efeito_blobs_fundo: payload.branding.efeitoBlobsFundo,
        tema: payload.branding.tema,
        playbook_titulo: payload.branding.playbookTitulo,
        playbook_descricao: payload.branding.playbookDescricao,
        playbook_capa_url: payload.branding.playbookCapaUrl,
        playbook_arquivo_url: payload.branding.playbookArquivoUrl,
      },
      aluno: {
        id: payload.aluno.id,
        nome_completo: payload.aluno.nomeCompleto,
        email_acesso: payload.aluno.emailAcesso,
      },
      ferramentas: payload.ferramentas.map((item) => ({
        id: item.id,
        slug: item.slug,
        nome: item.nome,
        descricao: item.descricao,
        url: item.url,
        icone_url: item.iconeUrl,
        categoria: item.categoria,
        tipo_abertura: item.tipoAbertura,
        destaque: item.destaque,
      })),
      novidades: payload.novidades.map((item) => ({
        id: item.id,
        slug: item.slug,
        titulo: item.titulo,
        resumo: item.resumo,
        imagem_url: item.imagemUrl,
        fonte_nome: item.fonteNome,
        fonte_url: item.fonteUrl,
        categoria: item.categoria,
        publicado_em: item.publicadoEm,
        destaque: item.destaque,
      })),
      aulas: payload.aulas.map((item) => ({
        id: item.id,
        slug: item.slug,
        titulo: item.titulo,
        descricao: item.descricao,
        modulo: item.modulo,
        video_url: item.videoUrl,
        material_url: item.materialUrl,
        thumbnail_url: item.thumbnailUrl,
        duracao_minutos: item.duracaoMinutos,
        tipo_conteudo: item.tipoConteudo,
        modulo_ordem: item.moduloOrdem,
        ordem: item.ordem,
      })),
      cursos: payload.cursos.map((item) => ({
        id: item.id,
        titulo: item.titulo,
        descricao: item.descricao,
        capa_url: item.capaUrl,
        categoria: item.categoria,
        nivel: item.nivel,
        total_aulas: item.totalAulas,
        primeira_aula_id: item.primeiraAulaId,
        primeira_aula_slug: item.primeiraAulaSlug,
        ordem: item.ordem,
        destaque: item.destaque,
      })),
    };
  });
