import { createServerFn } from "@tanstack/react-start";
import {
  getAulaPlayerApi,
  marcarAulaConcluidaApi,
  postarComentarioApi,
  removerComentarioApi,
  salvarProgressoVideoApi,
  toggleCurtidaComentarioApi,
} from "./aula-player.api";

export type AulaPlayerComentario = {
  id: string;
  parent_id: string | null;
  conteudo: string;
  criado_em: string;
  autor_nome: string;
  autor_tipo: "aluno" | "admin";
  autor_id: string;
  curtidas: number;
  liked_by_me: boolean;
  is_mine: boolean;
};

export type AulaPlayerModuloAula = {
  id: string;
  titulo: string;
  ordem: number;
  duracao_minutos: number | null;
  concluida: boolean;
};

export type AulaPlayerModulo = {
  id: string;
  titulo: string;
  ordem: number;
  aulas: AulaPlayerModuloAula[];
};

export type AulaPlayerRecomendado = {
  curso_id: string;
  titulo: string;
  capa_url: string | null;
  primeira_aula_id: string | null;
  total_aulas: number;
};

export type AulaPlayerData = {
  branding: {
    id: string;
    slug: string;
    nome: string;
    logo_url: string | null;
    cor_primaria: string;
    cor_secundaria: string;
    cor_fundo: string;
    cor_texto: string;
    cor_botao: string;
    cor_card: string;
    cor_borda: string;
    tema: "claro" | "escuro";
  };
  aluno: { id: string; nome_completo: string };
  curso: { id: string; titulo: string };
  modulo_atual: { id: string; titulo: string };
  aula: {
    id: string;
    titulo: string;
    descricao: string | null;
    video_url: string | null;
    material_url: string | null;
    duracao_minutos: number | null;
    tipo_conteudo: string | null;
    concluida: boolean;
    segundos_assistidos: number;
  };
  proxima_aula_id: string | null;
  proxima_aula_titulo: string | null;
  modulos: AulaPlayerModulo[];
  recomendados: AulaPlayerRecomendado[];
  comentarios: AulaPlayerComentario[];
};

function validateSlugAndAulaId(input: { slug: string; aulaId: string }) {
  if (!input?.slug || !input?.aulaId) throw new Error("parâmetros inválidos");
  if (!/^[0-9a-f-]{36}$/.test(input.aulaId)) throw new Error("parâmetros inválidos");
  return input;
}

export const getAulaPlayer = createServerFn({ method: "POST" })
  .inputValidator(validateSlugAndAulaId)
  .handler(async ({ data }): Promise<AulaPlayerData> => {
    const payload = await getAulaPlayerApi(data.slug, data.aulaId);
    return {
      branding: {
        id: payload.branding.id,
        slug: payload.branding.slug,
        nome: payload.branding.nome,
        logo_url: payload.branding.logoUrl,
        cor_primaria: payload.branding.corPrimaria,
        cor_secundaria: payload.branding.corSecundaria,
        cor_fundo: payload.branding.corFundo,
        cor_texto: payload.branding.corTexto,
        cor_botao: payload.branding.corBotao,
        cor_card: payload.branding.corCard,
        cor_borda: payload.branding.corBorda,
        tema: payload.branding.tema,
      },
      aluno: { id: payload.aluno.id, nome_completo: payload.aluno.nomeCompleto },
      curso: payload.curso,
      modulo_atual: { id: payload.moduloAtual.id, titulo: payload.moduloAtual.titulo },
      aula: {
        id: payload.aula.id,
        titulo: payload.aula.titulo,
        descricao: payload.aula.descricao,
        video_url: payload.aula.videoUrl,
        material_url: payload.aula.materialUrl,
        duracao_minutos: payload.aula.duracaoMinutos,
        tipo_conteudo: payload.aula.tipoConteudo,
        concluida: payload.aula.concluida,
        segundos_assistidos: payload.aula.segundosAssistidos,
      },
      proxima_aula_id: payload.proximaAulaId,
      proxima_aula_titulo: payload.proximaAulaTitulo,
      modulos: payload.modulos.map((modulo) => ({
        id: modulo.id,
        titulo: modulo.titulo,
        ordem: modulo.ordem,
        aulas: modulo.aulas.map((aula) => ({
          id: aula.id,
          titulo: aula.titulo,
          ordem: aula.ordem,
          duracao_minutos: aula.duracaoMinutos,
          concluida: aula.concluida,
        })),
      })),
      recomendados: payload.recomendados.map((curso) => ({
        curso_id: curso.cursoId,
        titulo: curso.titulo,
        capa_url: curso.capaUrl,
        primeira_aula_id: curso.primeiraAulaId,
        total_aulas: curso.totalAulas,
      })),
      comentarios: payload.comentarios.map((comentario) => ({
        id: comentario.id,
        parent_id: comentario.parentId,
        conteudo: comentario.conteudo,
        criado_em: comentario.criadoEm,
        autor_nome: comentario.autorNome,
        autor_tipo: comentario.autorTipo,
        autor_id: comentario.autorId,
        curtidas: comentario.curtidas,
        liked_by_me: comentario.likedByMe,
        is_mine: comentario.isMine,
      })),
    };
  });

export const marcarAulaConcluida = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; aulaId: string; concluida: boolean }) => {
    validateSlugAndAulaId(input);
    return input;
  })
  .handler(async ({ data }) => marcarAulaConcluidaApi(data.slug, data.aulaId, data.concluida));

export const postarComentario = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; aulaId: string; conteudo: string; parentId?: string | null }) => {
    validateSlugAndAulaId(input);
    if (!input.conteudo || input.conteudo.trim().length < 1 || input.conteudo.length > 4000) {
      throw new Error("Conteúdo inválido");
    }
    return input;
  })
  .handler(async ({ data }) => postarComentarioApi(data.slug, data.aulaId, data.conteudo, data.parentId));

export const salvarProgressoVideo = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; aulaId: string; segundos: number; concluida?: boolean }) => {
    validateSlugAndAulaId(input);
    if (typeof input.segundos !== "number" || input.segundos < 0 || input.segundos > 86400) {
      throw new Error("Segundos inválidos");
    }
    return input;
  })
  .handler(async ({ data }) => salvarProgressoVideoApi(data.slug, data.aulaId, data.segundos, data.concluida));

export const removerComentario = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; aulaId: string; comentarioId: string }) => {
    validateSlugAndAulaId(input);
    if (!/^[0-9a-f-]{36}$/.test(input.comentarioId)) throw new Error("parâmetros inválidos");
    return input;
  })
  .handler(async ({ data }) => removerComentarioApi(data.slug, data.aulaId, data.comentarioId));

export const toggleCurtidaComentario = createServerFn({ method: "POST" })
  .inputValidator((input: { slug: string; aulaId: string; comentarioId: string }) => {
    validateSlugAndAulaId(input);
    if (!/^[0-9a-f-]{36}$/.test(input.comentarioId)) throw new Error("parâmetros inválidos");
    return input;
  })
  .handler(async ({ data }) => toggleCurtidaComentarioApi(data.slug, data.aulaId, data.comentarioId));
