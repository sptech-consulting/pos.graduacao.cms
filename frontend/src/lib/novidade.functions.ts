import { createServerFn } from "@tanstack/react-start";
import { getNovidadeDetalheApi } from "./novidade.api";

export type NovidadeDetalhe = {
  id: string;
  titulo: string;
  resumo: string | null;
  conteudo: string | null;
  imagem_url: string | null;
  fonte_url: string | null;
  fonte_nome: string | null;
  categoria: string | null;
  publicado_em: string | null;
  ambiente_slug: string;
  ambiente_nome: string;
};

export const getNovidadeDetalhe = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; novidadeId: string }) => {
    if (!input?.slug || typeof input.slug !== "string" || input.slug.length > 120) {
      throw new Error("slug inválido");
    }
    if (!input?.novidadeId || typeof input.novidadeId !== "string") {
      throw new Error("id inválido");
    }
    if (!/^[0-9a-f-]{36}$/.test(input.novidadeId)) {
      throw new Error("id inválido");
    }

    return input;
  })
  .handler(async ({ data }): Promise<NovidadeDetalhe> => {
    const n = await getNovidadeDetalheApi(data.slug, data.novidadeId);

    return {
      id: n.id,
      titulo: n.titulo,
      resumo: n.resumo,
      conteudo: n.conteudo,
      imagem_url: n.imagemUrl,
      fonte_url: n.fonteUrl,
      fonte_nome: n.fonteNome,
      categoria: n.categoria,
      publicado_em: n.publicadoEm,
      ambiente_slug: n.ambienteSlug,
      ambiente_nome: n.ambienteNome,
    };
  });
