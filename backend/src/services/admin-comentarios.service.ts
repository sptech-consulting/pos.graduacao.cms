import { and, eq, gte, inArray } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  ambienteCursos,
  alunos,
  ambientes,
  aulaComentarios,
  aulaComentarioCurtidas,
  aulaProgresso,
  aulas,
  cursos,
  logsAuditoria,
  modulos,
  usuariosAdmin,
} from "../db/schema/index.js";
import { audit } from "./audit.service.js";

export type AdminComentarioRow = {
  id: string;
  conteudo: string;
  status: string;
  criadoEm: string;
  ambienteId: string;
  ambienteNome: string;
  ambienteSlug: string;
  aulaId: string;
  aulaTitulo: string;
  autorNome: string;
  autorTipo: "aluno" | "admin";
  parentId: string | null;
  curtidas: number;
};

export type AdminLogRow = {
  id: string;
  acao: string;
  entidade: string | null;
  entidadeId: string | null;
  ambienteId: string | null;
  ambienteNome: string | null;
  usuarioAdminId: string | null;
  usuarioAdminNome: string | null;
  dadosNovos: unknown;
  dadosAnteriores: unknown;
  criadoEm: string;
};

export type AdminMetricas = {
  totais: {
    ambientesAtivos: number;
    alunosAtivos: number;
    cursosPublicados: number;
    aulasPublicadas: number;
    comentarios30d: number;
    aulasConcluidas30d: number;
  };
  aulasMaisAssistidas: { id: string; titulo: string; visualizacoes: number }[];
  comentariosPorDia: { data: string; total: number }[];
  ambientesMaisEngajados: { id: string; nome: string; comentarios: number; conclusoes: number }[];
};

export class AdminComentarioNotFoundError extends Error {
  constructor(comentarioId: string) {
    super(`Comentário não encontrado: ${comentarioId}`);
    this.name = "AdminComentarioNotFoundError";
  }
}

export async function listAdminComentarios(filters: {
  status?: string;
  ambienteId?: string;
  busca?: string;
}): Promise<AdminComentarioRow[]> {
  let rows = await db
    .select({
      id: aulaComentarios.id,
      conteudo: aulaComentarios.conteudo,
      status: aulaComentarios.status,
      criadoEm: aulaComentarios.criadoEm,
      ambienteId: aulaComentarios.ambienteId,
      aulaId: aulaComentarios.aulaId,
      alunoId: aulaComentarios.alunoId,
      usuarioAdminId: aulaComentarios.usuarioAdminId,
      parentId: aulaComentarios.parentId,
    })
    .from(aulaComentarios)
    .orderBy(aulaComentarios.criadoEm);

  if (filters.status) rows = rows.filter((row) => row.status === filters.status);
  if (filters.ambienteId) rows = rows.filter((row) => row.ambienteId === filters.ambienteId);
  if (filters.busca) {
    const query = filters.busca.toLowerCase();
    rows = rows.filter((row) => row.conteudo.toLowerCase().includes(query));
  }

  rows = rows.slice(-200).reverse();

  const alunoIds = [...new Set(rows.map((row) => row.alunoId).filter(Boolean) as string[])];
  const adminIds = [...new Set(rows.map((row) => row.usuarioAdminId).filter(Boolean) as string[])];
  const ambienteIds = [...new Set(rows.map((row) => row.ambienteId))];
  const aulaIds = [...new Set(rows.map((row) => row.aulaId))];

  const [alunoRows, adminRows, ambienteRows, aulaRows, curtidaRows] = await Promise.all([
    alunoIds.length
      ? db.select({ id: alunos.id, nomeCompleto: alunos.nomeCompleto }).from(alunos).where(inArray(alunos.id, alunoIds))
      : Promise.resolve([]),
    adminIds.length
      ? db.select({ id: usuariosAdmin.id, nome: usuariosAdmin.nome }).from(usuariosAdmin).where(inArray(usuariosAdmin.id, adminIds))
      : Promise.resolve([]),
    ambienteIds.length
      ? db.select({ id: ambientes.id, nome: ambientes.nome, slug: ambientes.slug }).from(ambientes).where(inArray(ambientes.id, ambienteIds))
      : Promise.resolve([]),
    aulaIds.length
      ? db.select({ id: aulas.id, titulo: aulas.titulo }).from(aulas).where(inArray(aulas.id, aulaIds))
      : Promise.resolve([]),
    rows.length
      ? db.select({ comentarioId: aulaComentarioCurtidas.comentarioId }).from(aulaComentarioCurtidas).where(inArray(aulaComentarioCurtidas.comentarioId, rows.map((row) => row.id)))
      : Promise.resolve([]),
  ]);

  const alunoMap = new Map(alunoRows.map((row) => [row.id, row.nomeCompleto]));
  const adminMap = new Map(adminRows.map((row) => [row.id, row.nome]));
  const ambienteMap = new Map(ambienteRows.map((row) => [row.id, row]));
  const aulaMap = new Map(aulaRows.map((row) => [row.id, row.titulo]));
  const curtidasMap = new Map<string, number>();
  curtidaRows.forEach((row) => curtidasMap.set(row.comentarioId, (curtidasMap.get(row.comentarioId) ?? 0) + 1));

  return rows.map((row) => {
    const ambiente = ambienteMap.get(row.ambienteId);
    return {
      id: row.id,
      conteudo: row.conteudo,
      status: row.status,
      criadoEm: row.criadoEm.toISOString(),
      ambienteId: row.ambienteId,
      ambienteNome: ambiente?.nome ?? "—",
      ambienteSlug: ambiente?.slug ?? "",
      aulaId: row.aulaId,
      aulaTitulo: aulaMap.get(row.aulaId) ?? "—",
      autorNome: row.alunoId ? alunoMap.get(row.alunoId) ?? "Aluno" : adminMap.get(row.usuarioAdminId ?? "") ?? "Equipe",
      autorTipo: row.alunoId ? "aluno" : "admin",
      parentId: row.parentId,
      curtidas: curtidasMap.get(row.id) ?? 0,
    };
  });
}

export async function moderarComentarioAdmin(params: {
  comentarioId: string;
  status: "ativo" | "oculto" | "removido";
  usuarioAdminId: string;
  ip?: string;
}): Promise<{ ok: true }> {
  const [comentario] = await db
    .select({ id: aulaComentarios.id, ambienteId: aulaComentarios.ambienteId, status: aulaComentarios.status })
    .from(aulaComentarios)
    .where(eq(aulaComentarios.id, params.comentarioId))
    .limit(1);

  if (!comentario) throw new AdminComentarioNotFoundError(params.comentarioId);

  await db.update(aulaComentarios).set({ status: params.status, atualizadoEm: new Date() }).where(eq(aulaComentarios.id, params.comentarioId));

  await audit({
    usuarioAdminId: params.usuarioAdminId,
    ambienteId: comentario.ambienteId,
    acao: `comentario.moderado.${params.status}`,
    entidade: "aula_comentarios",
    entidadeId: params.comentarioId,
    dadosAnteriores: { status: comentario.status },
    dadosNovos: { status: params.status },
    ip: params.ip,
  });

  return { ok: true };
}

export async function listAdminLogs(filters: { acao?: string; ambienteId?: string; limit?: number }): Promise<AdminLogRow[]> {
  let rows = await db.select().from(logsAuditoria).orderBy(logsAuditoria.criadoEm);
  if (filters.acao) rows = rows.filter((row) => row.acao.toLowerCase().includes(filters.acao!.toLowerCase()));
  if (filters.ambienteId) rows = rows.filter((row) => row.ambienteId === filters.ambienteId);

  const limited = rows.slice(-(Math.min(filters.limit ?? 200, 500))).reverse();
  const ambienteIds = [...new Set(limited.map((row) => row.ambienteId).filter(Boolean) as string[])];
  const adminIds = [...new Set(limited.map((row) => row.usuarioAdminId).filter(Boolean) as string[])];
  const [ambienteRows, adminRows] = await Promise.all([
    ambienteIds.length
      ? db.select({ id: ambientes.id, nome: ambientes.nome }).from(ambientes).where(inArray(ambientes.id, ambienteIds))
      : Promise.resolve([]),
    adminIds.length
      ? db.select({ id: usuariosAdmin.id, nome: usuariosAdmin.nome }).from(usuariosAdmin).where(inArray(usuariosAdmin.id, adminIds))
      : Promise.resolve([]),
  ]);
  const ambienteMap = new Map(ambienteRows.map((row) => [row.id, row.nome]));
  const adminMap = new Map(adminRows.map((row) => [row.id, row.nome]));

  return limited.map((row) => ({
    id: row.id,
    acao: row.acao,
    entidade: row.entidade ?? null,
    entidadeId: row.entidadeId ?? null,
    ambienteId: row.ambienteId ?? null,
    ambienteNome: row.ambienteId ? ambienteMap.get(row.ambienteId) ?? null : null,
    usuarioAdminId: row.usuarioAdminId ?? null,
    usuarioAdminNome: row.usuarioAdminId ? adminMap.get(row.usuarioAdminId) ?? null : null,
    dadosNovos: row.dadosNovos,
    dadosAnteriores: row.dadosAnteriores,
    criadoEm: row.criadoEm.toISOString(),
  }));
}

export async function getAdminMetricas(): Promise<AdminMetricas> {
  const since30 = new Date(Date.now() - 30 * 86400_000);
  const [ambienteRows, alunoRows, cursoRows, aulaRows, comentarioRows30, progressoRows30, progressoRowsAll] = await Promise.all([
    db.select({ id: ambientes.id }).from(ambientes).where(eq(ambientes.status, "ativo")),
    db.select({ id: alunos.id }).from(alunos).where(eq(alunos.status, "ativo")),
    db.select({ id: cursos.id }).from(cursos).where(eq(cursos.status, "publicada")),
    db.select({ id: aulas.id, titulo: aulas.titulo, moduloId: aulas.moduloId }).from(aulas).where(eq(aulas.status, "publicada")),
    db.select({ id: aulaComentarios.id, criadoEm: aulaComentarios.criadoEm, ambienteId: aulaComentarios.ambienteId }).from(aulaComentarios).where(and(eq(aulaComentarios.status, "ativo"), gte(aulaComentarios.criadoEm, since30))),
    db.select({ aulaId: aulaProgresso.aulaId, concluidaEm: aulaProgresso.concluidaEm }).from(aulaProgresso).where(and(eq(aulaProgresso.concluida, "1"), gte(aulaProgresso.concluidaEm, since30))),
    db.select({ aulaId: aulaProgresso.aulaId }).from(aulaProgresso),
  ]);

  const viewCountByAula = new Map<string, number>();
  progressoRowsAll.forEach((row) => viewCountByAula.set(row.aulaId, (viewCountByAula.get(row.aulaId) ?? 0) + 1));
  const aulaTitleMap = new Map(aulaRows.map((row) => [row.id, row.titulo]));
  const aulasMaisAssistidas = Array.from(viewCountByAula.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 5)
    .map(([id, visualizacoes]) => ({ id, titulo: aulaTitleMap.get(id) ?? "—", visualizacoes }));

  const comentarioPorDiaMap = new Map<string, number>();
  comentarioRows30.forEach((row) => {
    const day = row.criadoEm.toISOString().slice(0, 10);
    comentarioPorDiaMap.set(day, (comentarioPorDiaMap.get(day) ?? 0) + 1);
  });
  const comentariosPorDia: { data: string; total: number }[] = [];
  for (let i = 13; i >= 0; i -= 1) {
    const day = new Date(Date.now() - i * 86400_000).toISOString().slice(0, 10);
    comentariosPorDia.push({ data: day, total: comentarioPorDiaMap.get(day) ?? 0 });
  }

  const moduloRows = await db.select({ id: modulos.id, cursoId: modulos.cursoId }).from(modulos);
  const comentarioByAmbiente = new Map<string, number>();
  comentarioRows30.forEach((row) => comentarioByAmbiente.set(row.ambienteId, (comentarioByAmbiente.get(row.ambienteId) ?? 0) + 1));

  const moduloCursoMap = new Map(moduloRows.map((row) => [row.id, row.cursoId]));
  const aulaCursoMap = new Map(aulaRows.map((row) => [row.id, moduloCursoMap.get(row.moduloId ?? "") ?? null]));
  const ambienteCursosRows = await db
    .select({ ambienteId: ambienteCursos.ambienteId, cursoId: ambienteCursos.cursoId })
    .from(ambienteCursos)
    .where(eq(ambienteCursos.status, "ativo"));
  const ambienteIdsByCurso = new Map<string, string[]>();
  ambienteCursosRows.forEach((row) => {
    const current = ambienteIdsByCurso.get(row.cursoId) ?? [];
    current.push(row.ambienteId);
    ambienteIdsByCurso.set(row.cursoId, current);
  });
  const conclusoesByAmbiente = new Map<string, number>();
  progressoRows30.forEach((row) => {
    const cursoId = aulaCursoMap.get(row.aulaId);
    if (!cursoId) return;
    (ambienteIdsByCurso.get(cursoId) ?? []).forEach((ambienteId) => {
      conclusoesByAmbiente.set(ambienteId, (conclusoesByAmbiente.get(ambienteId) ?? 0) + 1);
    });
  });

  const ambienteNomeMap = new Map((await db.select({ id: ambientes.id, nome: ambientes.nome }).from(ambientes)).map((row) => [row.id, row.nome]));
  const rankingIds = [...new Set([...comentarioByAmbiente.keys(), ...conclusoesByAmbiente.keys()])]
    .sort((left, right) => (comentarioByAmbiente.get(right) ?? 0) + (conclusoesByAmbiente.get(right) ?? 0) - ((comentarioByAmbiente.get(left) ?? 0) + (conclusoesByAmbiente.get(left) ?? 0)))
    .slice(0, 5);

  return {
    totais: {
      ambientesAtivos: ambienteRows.length,
      alunosAtivos: alunoRows.length,
      cursosPublicados: cursoRows.length,
      aulasPublicadas: aulaRows.length,
      comentarios30d: comentarioRows30.length,
      aulasConcluidas30d: progressoRows30.length,
    },
    aulasMaisAssistidas,
    comentariosPorDia,
    ambientesMaisEngajados: rankingIds.map((id) => ({
      id,
      nome: ambienteNomeMap.get(id) ?? "—",
      comentarios: comentarioByAmbiente.get(id) ?? 0,
      conclusoes: conclusoesByAmbiente.get(id) ?? 0,
    })),
  };
}
