import { createServerFn } from "@tanstack/react-start";
import {
  getAdminMetricasApi,
  listarComentariosAdminApi,
  listarLogsAuditoriaApi,
  moderarComentarioApi,
  type BackendAdminComentarioRow,
  type BackendAdminLogRow,
  type BackendAdminMetricas,
} from "./admin-comentarios.api";

export type AdminComentarioRow = {
  id: string;
  conteudo: string;
  status: string;
  criado_em: string;
  ambiente_id: string;
  ambiente_nome: string;
  aula_id: string;
  aula_titulo: string;
  ambiente_slug: string;
  autor_nome: string;
  autor_tipo: "aluno" | "admin";
  parent_id: string | null;
  curtidas: number;
};

function mapComentario(row: BackendAdminComentarioRow): AdminComentarioRow {
  return {
    id: row.id,
    conteudo: row.conteudo,
    status: row.status,
    criado_em: row.criadoEm,
    ambiente_id: row.ambienteId,
    ambiente_nome: row.ambienteNome,
    aula_id: row.aulaId,
    aula_titulo: row.aulaTitulo,
    ambiente_slug: row.ambienteSlug,
    autor_nome: row.autorNome,
    autor_tipo: row.autorTipo,
    parent_id: row.parentId,
    curtidas: row.curtidas,
  };
}

export const listarComentariosAdmin = createServerFn({ method: "POST" })
  .inputValidator((input: { status?: string; ambienteId?: string; busca?: string }) => input)
  .handler(async ({ data }): Promise<AdminComentarioRow[]> => {
    const rows = await listarComentariosAdminApi(data);
    return rows.map(mapComentario);
  });

export const moderarComentario = createServerFn({ method: "POST" })
  .inputValidator((input: { comentarioId: string; status: "ativo" | "oculto" | "removido" }) => {
    if (!/^[0-9a-f-]{36}$/.test(input.comentarioId)) throw new Error("comentarioId inválido");
    if (!["ativo", "oculto", "removido"].includes(input.status)) throw new Error("status inválido");
    return input;
  })
  .handler(async ({ data }) => moderarComentarioApi(data));

export type AdminLogRow = {
  id: string;
  acao: string;
  entidade: string | null;
  entidade_id: string | null;
  ambiente_id: string | null;
  ambiente_nome: string | null;
  usuario_admin_id: string | null;
  usuario_admin_nome: string | null;
  dados_novos: unknown;
  dados_anteriores: unknown;
  criado_em: string;
};

function mapLog(row: BackendAdminLogRow): AdminLogRow {
  return {
    id: row.id,
    acao: row.acao,
    entidade: row.entidade,
    entidade_id: row.entidadeId,
    ambiente_id: row.ambienteId,
    ambiente_nome: row.ambienteNome,
    usuario_admin_id: row.usuarioAdminId,
    usuario_admin_nome: row.usuarioAdminNome,
    dados_novos: row.dadosNovos,
    dados_anteriores: row.dadosAnteriores,
    criado_em: row.criadoEm,
  };
}

export const listarLogsAuditoria = createServerFn({ method: "POST" })
  .inputValidator((input: { acao?: string; ambienteId?: string; limit?: number }) => input)
  .handler(async ({ data }): Promise<AdminLogRow[]> => {
    const rows = await listarLogsAuditoriaApi(data);
    return rows.map(mapLog);
  });

export type AdminMetricas = {
  totais: {
    ambientes_ativos: number;
    alunos_ativos: number;
    cursos_publicados: number;
    aulas_publicadas: number;
    comentarios_30d: number;
    aulas_concluidas_30d: number;
  };
  aulas_mais_assistidas: { id: string; titulo: string; visualizacoes: number }[];
  comentarios_por_dia: { data: string; total: number }[];
  ambientes_mais_engajados: { id: string; nome: string; comentarios: number; conclusoes: number }[];
};

function mapMetricas(payload: BackendAdminMetricas): AdminMetricas {
  return {
    totais: {
      ambientes_ativos: payload.totais.ambientesAtivos,
      alunos_ativos: payload.totais.alunosAtivos,
      cursos_publicados: payload.totais.cursosPublicados,
      aulas_publicadas: payload.totais.aulasPublicadas,
      comentarios_30d: payload.totais.comentarios30d,
      aulas_concluidas_30d: payload.totais.aulasConcluidas30d,
    },
    aulas_mais_assistidas: payload.aulasMaisAssistidas,
    comentarios_por_dia: payload.comentariosPorDia,
    ambientes_mais_engajados: payload.ambientesMaisEngajados,
  };
}

export const getAdminMetricas = createServerFn({ method: "POST" })
  .inputValidator(() => ({}))
  .handler(async (): Promise<AdminMetricas> => mapMetricas(await getAdminMetricasApi()));
