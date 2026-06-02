import { createServerFn } from "@tanstack/react-start";
import {
  getPublicTrabalhoApi,
  listPublicTrabalhosApi,
  resolvePublicAmbienteByCodeApi,
} from "./trabalhos.api";

function normCodigo(codigo: string) {
  return (codigo || "").toUpperCase().replace(/\s+/g, "");
}

export const resolverAmbientePorCodigo = createServerFn({ method: "POST" })
  .inputValidator((input: { codigo: string }) => {
    if (!input?.codigo || typeof input.codigo !== "string" || input.codigo.length > 64) {
      throw new Error("Código inválido");
    }

    return { codigo: normCodigo(input.codigo) };
  })
  .handler(async ({ data }) => {
    const ambiente = await resolvePublicAmbienteByCodeApi(data.codigo);
    return {
      ambiente_id: ambiente.ambienteId,
      nome: ambiente.nome,
      slug: ambiente.slug,
      logo_url: ambiente.logoUrl,
      cor_primaria: ambiente.corPrimaria,
      cor_secundaria: ambiente.corSecundaria,
      cor_fundo: ambiente.corFundo,
      cor_texto: ambiente.corTexto,
    };
  });

export const listarTrabalhosPublicos = createServerFn({ method: "POST" })
  .inputValidator((input: { codigo: string }) => {
    if (!input?.codigo) throw new Error("Código inválido");

    return { codigo: normCodigo(input.codigo) };
  })
  .handler(async ({ data }) => {
    const ambiente = await resolvePublicAmbienteByCodeApi(data.codigo);
    const list = await listPublicTrabalhosApi(ambiente.ambienteId);
    return list.map((t) => ({
      id: t.id,
      titulo: t.titulo,
      resumo: t.resumo,
      autor_nome: t.autorNome,
      turma: t.turma,
      imagem_capa_url: t.imagemCapaUrl,
      tags: t.tags,
      destaque: false,
      publicado_em: t.publicadoEm,
      slug: null as string | null,
    }));
  });

export type TrabalhoPublicoCompleto = {
  id: string;
  titulo: string;
  subtitulo: string | null;
  resumo: string | null;
  conteudo: string | null;
  autor_nome: string;
  turma: string | null;
  imagem_capa_url: string | null;
  link_externo: string | null;
  tags: string[] | null;
  publicado_em: string | null;
  ambiente_nome: string;
  ambiente_slug: string;
  apresentacao_tipo: "video" | "pptx" | "imagem" | "documento" | "link" | null;
  apresentacao_url: string | null;
  apresentacao_titulo: string | null;
  apresentacao_descricao: string | null;
  apresentacao_imagem_url: string | null;
  aplicacao_expectativa: string | null;
  ordem: number;
  funcionalidades: Array<{
    id: string;
    ordem: number;
    titulo: string;
    descricao: string | null;
    imagem_url: string | null;
  }>;
  links: Array<{
    id: string;
    ordem: number;
    rotulo: string;
    url: string;
    icone_url: string | null;
  }>;
};

export const obterTrabalhoPublico = createServerFn({ method: "POST" })
  .inputValidator((input: { codigo: string; trabalhoId: string }) => {
    if (!input?.codigo || !input?.trabalhoId) throw new Error("Parâmetros inválidos");

    return { codigo: normCodigo(input.codigo), trabalhoId: input.trabalhoId };
  })
  .handler(async ({ data }): Promise<TrabalhoPublicoCompleto> => {
    const ambiente = await resolvePublicAmbienteByCodeApi(data.codigo);
    const trabalho = await getPublicTrabalhoApi(ambiente.ambienteId, data.trabalhoId);

    return {
      id: trabalho.id,
      titulo: trabalho.titulo,
      subtitulo: trabalho.subtitulo,
      resumo: trabalho.resumo,
      conteudo: trabalho.conteudo,
      autor_nome: trabalho.autorNome,
      turma: trabalho.turma,
      imagem_capa_url: trabalho.imagemCapaUrl,
      link_externo: trabalho.linkExterno,
      tags: trabalho.tags,
      publicado_em: trabalho.publicadoEm,
      ambiente_nome: trabalho.ambienteNome,
      ambiente_slug: trabalho.ambienteSlug,
      apresentacao_tipo: trabalho.apresentacaoTipo,
      apresentacao_url: trabalho.apresentacaoUrl,
      apresentacao_titulo: trabalho.apresentacaoTitulo,
      apresentacao_descricao: trabalho.apresentacaoDescricao,
      apresentacao_imagem_url: trabalho.apresentacaoImagemUrl,
      aplicacao_expectativa: trabalho.aplicacaoExpectativa,
      ordem: trabalho.ordem,
      funcionalidades: trabalho.funcionalidades.map((item) => ({
        id: item.id,
        ordem: item.ordem,
        titulo: item.titulo,
        descricao: item.descricao,
        imagem_url: item.imagemUrl,
      })),
      links: trabalho.links.map((item) => ({
        id: item.id,
        ordem: item.ordem,
        rotulo: item.rotulo,
        url: item.url,
        icone_url: item.iconeUrl,
      })),
    };
  });

export const registrarVisualizacaoTrabalho = createServerFn({ method: "POST" })
  .inputValidator((input: { codigo: string; trabalhoId: string }) => {
    if (!input?.codigo || !input?.trabalhoId) throw new Error("Parâmetros inválidos");

    return { codigo: normCodigo(input.codigo), trabalhoId: input.trabalhoId };
  })
  .handler(async () => ({ ok: true }));
