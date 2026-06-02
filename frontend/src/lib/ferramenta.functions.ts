import { createServerFn } from "@tanstack/react-start";
import { getFerramentaDetalheApi } from "./ferramenta.api";

export type FerramentaTagTipo = "input" | "output" | "integracao";

export type FerramentaDetalhe = {
  id: string;
  nome: string;
  descricao: string | null;
  subtitulo: string | null;
  descricao_longa: string | null;
  url: string | null;
  icone_url: string | null;
  imagem_capa_url: string | null;
  categoria: string | null;
  tipo_abertura: "nova_aba" | "mesma_aba" | "modal" | null;
  frase_destaque: string | null;
  casos_uso: { id: string; texto: string }[];
  tags: { id: string; tipo: FerramentaTagTipo; rotulo: string }[];
  blocos: { id: string; titulo: string; conteudo: string }[];
  funcionalidades: { id: string; titulo: string; descricao: string | null; imagem_url: string | null }[];
  casos_teste: { id: string; titulo: string; badge: string | null; prompt_exemplo: string | null; explicacao: string | null }[];
  ambiente_slug: string;
  ambiente_nome: string;
};

export const getFerramentaDetalhe = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; ferramentaId: string }) => {
    if (!input?.slug || typeof input.slug !== "string" || input.slug.length > 120) {
      throw new Error("slug inválido");
    }
    if (!input?.ferramentaId || typeof input.ferramentaId !== "string") {
      throw new Error("id inválido");
    }
    if (!/^[0-9a-f-]{36}$/.test(input.ferramentaId)) {
      throw new Error("id inválido");
    }

    return input;
  })
  .handler(async ({ data }): Promise<FerramentaDetalhe> => {
    const f = await getFerramentaDetalheApi(data.slug, data.ferramentaId);

    return {
      id: f.id,
      nome: f.nome,
      descricao: f.descricao,
      subtitulo: f.subtitulo,
      descricao_longa: f.descricaoLonga,
      url: f.url,
      icone_url: f.iconeUrl,
      imagem_capa_url: f.imagemCapaUrl,
      categoria: f.categoria,
      tipo_abertura: f.tipoAbertura,
      frase_destaque: f.fraseDestaque,
      casos_uso: f.casosUso.map((r) => ({ id: r.id, texto: r.texto })),
      tags: f.tags.map((r) => ({ id: r.id, tipo: r.tipo as FerramentaTagTipo, rotulo: r.rotulo })),
      blocos: f.blocos.map((r) => ({ id: r.id, titulo: r.titulo, conteudo: r.conteudo })),
      funcionalidades: f.funcionalidades.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        descricao: r.descricao,
        imagem_url: r.imagemUrl,
      })),
      casos_teste: f.casosTeste.map((r) => ({
        id: r.id,
        titulo: r.titulo,
        badge: r.badge,
        prompt_exemplo: r.promptExemplo,
        explicacao: r.explicacao,
      })),
      ambiente_slug: f.ambienteSlug,
      ambiente_nome: f.ambienteNome,
    };
  });
