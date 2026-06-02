import { and, eq, gte, inArray, ne } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  ambienteAlunos,
  ambienteCursos,
  ambientes,
  alunos,
  aulaComentarioCurtidas,
  aulaComentarios,
  aulaProgresso,
  aulas,
  cursos,
  logsAuditoria,
  modulos,
  usuariosAdmin,
} from "../db/schema/index.js";

type AcessoAula = {
  ambiente: { id: string; slug: string; nome: string; logoUrl: string | null; corPrimaria: string | null; corSecundaria: string | null; corFundo: string | null; corTexto: string | null; corBotao: string | null; corCard: string | null; corBorda: string | null; tema: string };
  aluno: { id: string; nomeCompleto: string; status: string };
  aula: { id: string; titulo: string; descricao: string | null; videoUrl: string | null; materialUrl: string | null; duracaoMinutos: number | null; tipoConteudo: string | null; moduloId: string | null; ordem: number; status: string };
  modulo: { id: string; titulo: string; ordem: number; cursoId: string };
};

export type AlunoAulaPlayerData = {
  branding: {
    id: string;
    slug: string;
    nome: string;
    logoUrl: string | null;
    corPrimaria: string;
    corSecundaria: string;
    corFundo: string;
    corTexto: string;
    corBotao: string;
    corCard: string;
    corBorda: string;
    tema: "claro" | "escuro";
  };
  aluno: { id: string; nomeCompleto: string };
  curso: { id: string; titulo: string };
  moduloAtual: { id: string; titulo: string };
  aula: {
    id: string;
    titulo: string;
    descricao: string | null;
    videoUrl: string | null;
    materialUrl: string | null;
    duracaoMinutos: number | null;
    tipoConteudo: string | null;
    concluida: boolean;
    segundosAssistidos: number;
  };
  proximaAulaId: string | null;
  proximaAulaTitulo: string | null;
  modulos: Array<{
    id: string;
    titulo: string;
    ordem: number;
    aulas: Array<{ id: string; titulo: string; ordem: number; duracaoMinutos: number | null; concluida: boolean }>;
  }>;
  recomendados: Array<{ cursoId: string; titulo: string; capaUrl: string | null; primeiraAulaId: string | null; totalAulas: number }>;
  comentarios: Array<{
    id: string;
    parentId: string | null;
    conteudo: string;
    criadoEm: string;
    autorNome: string;
    autorTipo: "aluno" | "admin";
    autorId: string;
    curtidas: number;
    likedByMe: boolean;
    isMine: boolean;
  }>;
};

export class AlunoAulaAmbienteNotFoundError extends Error {}
export class AlunoAulaAlunoNotFoundError extends Error {}
export class AlunoAulaAccessDeniedError extends Error {}
export class AlunoAulaNotFoundError extends Error {}
export class AlunoAulaComentarioNotFoundError extends Error {}
export class AlunoAulaComentarioForbiddenError extends Error {}
export class AlunoAulaComentarioRateLimitError extends Error {}

async function resolveAulaAccess(slug: string, aulaId: string, alunoId: string): Promise<AcessoAula> {
  const [ambiente] = await db
    .select({
      id: ambientes.id,
      slug: ambientes.slug,
      nome: ambientes.nome,
      logoUrl: ambientes.logoUrl,
      corPrimaria: ambientes.corPrimaria,
      corSecundaria: ambientes.corSecundaria,
      corFundo: ambientes.corFundo,
      corTexto: ambientes.corTexto,
      corBotao: ambientes.corBotao,
      corCard: ambientes.corCard,
      corBorda: ambientes.corBorda,
      tema: ambientes.tema,
    })
    .from(ambientes)
    .where(and(eq(ambientes.slug, slug), eq(ambientes.status, "ativo")))
    .limit(1);

  if (!ambiente) throw new AlunoAulaAmbienteNotFoundError(`Ambiente não encontrado ou inativo: ${slug}`);

  const [aluno] = await db
    .select({ id: alunos.id, nomeCompleto: alunos.nomeCompleto, status: alunos.status })
    .from(alunos)
    .where(eq(alunos.id, alunoId))
    .limit(1);

  if (!aluno || aluno.status !== "ativo") {
    throw new AlunoAulaAlunoNotFoundError(`Aluno não cadastrado ou inativo: ${alunoId}`);
  }

  const [vinculo] = await db
    .select({ id: ambienteAlunos.id })
    .from(ambienteAlunos)
    .where(and(eq(ambienteAlunos.ambienteId, ambiente.id), eq(ambienteAlunos.alunoId, aluno.id), eq(ambienteAlunos.status, "ativo")))
    .limit(1);

  if (!vinculo) throw new AlunoAulaAccessDeniedError(`Aluno ${alunoId} sem acesso a este ambiente: ${slug}`);

  const [aula] = await db
    .select({
      id: aulas.id,
      titulo: aulas.titulo,
      descricao: aulas.descricao,
      videoUrl: aulas.videoUrl,
      materialUrl: aulas.materialUrl,
      duracaoMinutos: aulas.duracaoMinutos,
      tipoConteudo: aulas.tipoConteudo,
      moduloId: aulas.moduloId,
      ordem: aulas.ordem,
      status: aulas.status,
    })
    .from(aulas)
    .where(eq(aulas.id, aulaId))
    .limit(1);

  if (!aula || aula.status !== "publicada" || !aula.moduloId) {
    throw new AlunoAulaNotFoundError(`Aula não encontrada ou indisponível: ${aulaId}`);
  }

  const [modulo] = await db
    .select({ id: modulos.id, titulo: modulos.titulo, ordem: modulos.ordem, cursoId: modulos.cursoId })
    .from(modulos)
    .where(eq(modulos.id, aula.moduloId))
    .limit(1);

  if (!modulo) throw new AlunoAulaNotFoundError(`Módulo não encontrado para aula: ${aulaId}`);

  const [cursoVinculado] = await db
    .select({ id: ambienteCursos.id })
    .from(ambienteCursos)
    .where(and(eq(ambienteCursos.ambienteId, ambiente.id), eq(ambienteCursos.cursoId, modulo.cursoId), eq(ambienteCursos.status, "ativo")))
    .limit(1);

  if (!cursoVinculado) {
    throw new AlunoAulaAccessDeniedError(`Curso ${modulo.cursoId} não disponível no ambiente ${slug}`);
  }

  return { ambiente, aluno, aula, modulo };
}

export async function getAlunoAulaPlayer(slug: string, aulaId: string, alunoId: string): Promise<AlunoAulaPlayerData> {
  const { ambiente, aluno, aula, modulo } = await resolveAulaAccess(slug, aulaId, alunoId);

  const [curso] = await db
    .select({ id: cursos.id, titulo: cursos.titulo })
    .from(cursos)
    .where(eq(cursos.id, modulo.cursoId))
    .limit(1);

  const modulosCurso = await db
    .select({ id: modulos.id, titulo: modulos.titulo, ordem: modulos.ordem })
    .from(modulos)
    .where(and(eq(modulos.cursoId, modulo.cursoId), eq(modulos.status, "ativo")))
    .orderBy(modulos.ordem);

  const moduloIds = modulosCurso.map((item) => item.id);
  const aulasCurso = moduloIds.length
    ? await db
        .select({ id: aulas.id, titulo: aulas.titulo, ordem: aulas.ordem, duracaoMinutos: aulas.duracaoMinutos, moduloId: aulas.moduloId })
        .from(aulas)
        .where(and(inArray(aulas.moduloId, moduloIds), eq(aulas.status, "publicada")))
        .orderBy(aulas.ordem)
    : [];

  const aulaIds = aulasCurso.map((item) => item.id);
  const progressoRows = aulaIds.length
    ? await db
        .select({ aulaId: aulaProgresso.aulaId, concluida: aulaProgresso.concluida, segundosAssistidos: aulaProgresso.segundosAssistidos })
        .from(aulaProgresso)
        .where(and(eq(aulaProgresso.alunoId, aluno.id), inArray(aulaProgresso.aulaId, aulaIds)))
    : [];

  const conclusaoSet = new Set(progressoRows.filter((item) => item.concluida === "1").map((item) => item.aulaId));
  const segundosMap = new Map(progressoRows.map((item) => [item.aulaId, item.segundosAssistidos]));

  const flatOrder = modulosCurso.flatMap((currentModulo) =>
    aulasCurso
      .filter((currentAula) => currentAula.moduloId === currentModulo.id)
      .map((currentAula) => ({ id: currentAula.id, titulo: currentAula.titulo, moduloOrdem: currentModulo.ordem, ordem: currentAula.ordem })),
  );
  flatOrder.sort((left, right) => left.moduloOrdem - right.moduloOrdem || left.ordem - right.ordem);
  const idx = flatOrder.findIndex((item) => item.id === aula.id);
  const proximaAula = idx >= 0 && idx < flatOrder.length - 1 ? flatOrder[idx + 1] : null;

  const outrosCursosVinculados = await db
    .select({ cursoId: ambienteCursos.cursoId })
    .from(ambienteCursos)
    .where(and(eq(ambienteCursos.ambienteId, ambiente.id), eq(ambienteCursos.status, "ativo"), ne(ambienteCursos.cursoId, modulo.cursoId)));
  const recomendadosIds = outrosCursosVinculados.map((item) => item.cursoId);
  const cursosRecomendados = recomendadosIds.length
    ? await db
        .select({ id: cursos.id, titulo: cursos.titulo, capaUrl: cursos.capaUrl })
        .from(cursos)
        .where(and(inArray(cursos.id, recomendadosIds), eq(cursos.status, "publicada")))
    : [];
  const modulosRecomendados = recomendadosIds.length
    ? await db
        .select({ id: modulos.id, cursoId: modulos.cursoId, ordem: modulos.ordem })
        .from(modulos)
        .where(and(inArray(modulos.cursoId, recomendadosIds), eq(modulos.status, "ativo")))
        .orderBy(modulos.ordem)
    : [];
  const moduloRecIds = modulosRecomendados.map((item) => item.id);
  const aulasRecomendadas = moduloRecIds.length
    ? await db
        .select({ id: aulas.id, moduloId: aulas.moduloId, ordem: aulas.ordem })
        .from(aulas)
        .where(and(inArray(aulas.moduloId, moduloRecIds), eq(aulas.status, "publicada")))
        .orderBy(aulas.ordem)
    : [];

  const comentarioRows = await db
    .select({ id: aulaComentarios.id, parentId: aulaComentarios.parentId, conteudo: aulaComentarios.conteudo, criadoEm: aulaComentarios.criadoEm, alunoId: aulaComentarios.alunoId, usuarioAdminId: aulaComentarios.usuarioAdminId })
    .from(aulaComentarios)
    .where(and(eq(aulaComentarios.aulaId, aula.id), eq(aulaComentarios.status, "ativo")))
    .orderBy(aulaComentarios.criadoEm);

  const comentarioAlunoIds = [...new Set(comentarioRows.map((item) => item.alunoId).filter(Boolean) as string[])];
  const comentarioAdminIds = [...new Set(comentarioRows.map((item) => item.usuarioAdminId).filter(Boolean) as string[])];
  const alunosComentario = comentarioAlunoIds.length
    ? await db.select({ id: alunos.id, nomeCompleto: alunos.nomeCompleto }).from(alunos).where(inArray(alunos.id, comentarioAlunoIds))
    : [];
  const adminsComentario = comentarioAdminIds.length
    ? await db.select({ id: usuariosAdmin.id, nome: usuariosAdmin.nome }).from(usuariosAdmin).where(inArray(usuariosAdmin.id, comentarioAdminIds))
    : [];
  const alunoNomeMap = new Map(alunosComentario.map((item) => [item.id, item.nomeCompleto]));
  const adminNomeMap = new Map(adminsComentario.map((item) => [item.id, item.nome]));

  const comentarioIds = comentarioRows.map((item) => item.id);
  const curtidasRows = comentarioIds.length
    ? await db.select({ comentarioId: aulaComentarioCurtidas.comentarioId, alunoId: aulaComentarioCurtidas.alunoId }).from(aulaComentarioCurtidas).where(inArray(aulaComentarioCurtidas.comentarioId, comentarioIds))
    : [];
  const curtidasCount = new Map<string, number>();
  const likedByMe = new Set<string>();
  for (const curtida of curtidasRows) {
    curtidasCount.set(curtida.comentarioId, (curtidasCount.get(curtida.comentarioId) ?? 0) + 1);
    if (curtida.alunoId === aluno.id) likedByMe.add(curtida.comentarioId);
  }

  return {
    branding: {
      id: ambiente.id,
      slug: ambiente.slug,
      nome: ambiente.nome,
      logoUrl: ambiente.logoUrl,
      corPrimaria: ambiente.corPrimaria ?? "#ED145B",
      corSecundaria: ambiente.corSecundaria ?? "#1F2A44",
      corFundo: ambiente.corFundo ?? "#FFFFFF",
      corTexto: ambiente.corTexto ?? "#1F2A44",
      corBotao: ambiente.corBotao ?? "#ED145B",
      corCard: ambiente.corCard ?? "#FFFFFF",
      corBorda: ambiente.corBorda ?? "#D0D3D4",
      tema: ambiente.tema === "escuro" ? "escuro" : "claro",
    },
    aluno: { id: aluno.id, nomeCompleto: aluno.nomeCompleto },
    curso: { id: curso?.id ?? modulo.cursoId, titulo: curso?.titulo ?? "Curso" },
    moduloAtual: { id: modulo.id, titulo: modulo.titulo },
    aula: {
      id: aula.id,
      titulo: aula.titulo,
      descricao: aula.descricao,
      videoUrl: aula.videoUrl,
      materialUrl: aula.materialUrl,
      duracaoMinutos: aula.duracaoMinutos,
      tipoConteudo: aula.tipoConteudo,
      concluida: conclusaoSet.has(aula.id),
      segundosAssistidos: segundosMap.get(aula.id) ?? 0,
    },
    proximaAulaId: proximaAula?.id ?? null,
    proximaAulaTitulo: proximaAula?.titulo ?? null,
    modulos: modulosCurso.map((currentModulo) => ({
      id: currentModulo.id,
      titulo: currentModulo.titulo,
      ordem: currentModulo.ordem,
      aulas: aulasCurso
        .filter((currentAula) => currentAula.moduloId === currentModulo.id)
        .map((currentAula) => ({
          id: currentAula.id,
          titulo: currentAula.titulo,
          ordem: currentAula.ordem,
          duracaoMinutos: currentAula.duracaoMinutos,
          concluida: conclusaoSet.has(currentAula.id),
        })),
    })),
    recomendados: cursosRecomendados.map((currentCurso) => {
      const idsModulo = modulosRecomendados.filter((item) => item.cursoId === currentCurso.id).map((item) => item.id);
      const aulasCursoRecomendado = aulasRecomendadas.filter((item) => idsModulo.includes(item.moduloId ?? ""));
      return {
        cursoId: currentCurso.id,
        titulo: currentCurso.titulo,
        capaUrl: currentCurso.capaUrl,
        primeiraAulaId: aulasCursoRecomendado[0]?.id ?? null,
        totalAulas: aulasCursoRecomendado.length,
      };
    }),
    comentarios: comentarioRows.map((item) => ({
      id: item.id,
      parentId: item.parentId,
      conteudo: item.conteudo,
      criadoEm: item.criadoEm.toISOString(),
      autorNome: item.alunoId ? alunoNomeMap.get(item.alunoId) ?? "Aluno" : adminNomeMap.get(item.usuarioAdminId ?? "") ?? "Equipe",
      autorTipo: item.alunoId ? "aluno" : "admin",
      autorId: item.alunoId ?? item.usuarioAdminId ?? "",
      curtidas: curtidasCount.get(item.id) ?? 0,
      likedByMe: likedByMe.has(item.id),
      isMine: item.alunoId === aluno.id,
    })),
  };
}

export async function setAlunoAulaConclusao(slug: string, aulaId: string, alunoId: string, concluida: boolean): Promise<{ ok: true }> {
  const { ambiente, aluno, aula } = await resolveAulaAccess(slug, aulaId, alunoId);
  const now = new Date();

  await db
    .insert(aulaProgresso)
    .values({ alunoId: aluno.id, aulaId: aula.id, concluida: concluida ? "1" : "0", concluidaEm: concluida ? now : null, atualizadoEm: now })
    .onDuplicateKeyUpdate({ set: { concluida: concluida ? "1" : "0", concluidaEm: concluida ? now : null, atualizadoEm: now } });

  await db.insert(logsAuditoria).values({ ambienteId: ambiente.id, acao: concluida ? "aula.concluida" : "aula.reaberta", entidade: "aulas", entidadeId: aula.id, dadosNovos: { alunoId: aluno.id, concluida } });
  return { ok: true };
}

export async function saveAlunoAulaProgresso(slug: string, aulaId: string, alunoId: string, segundos: number, concluida?: boolean): Promise<{ ok: true }> {
  const { aluno, aula } = await resolveAulaAccess(slug, aulaId, alunoId);
  const now = new Date();
  const update = { segundosAssistidos: Math.floor(segundos), atualizadoEm: now, ...(concluida ? { concluida: "1" as const, concluidaEm: now } : {}) };

  await db.insert(aulaProgresso).values({ alunoId: aluno.id, aulaId: aula.id, concluida: concluida ? "1" : "0", concluidaEm: concluida ? now : null, segundosAssistidos: Math.floor(segundos), atualizadoEm: now }).onDuplicateKeyUpdate({ set: update });
  return { ok: true };
}

export async function createAlunoAulaComentario(slug: string, aulaId: string, alunoId: string, conteudo: string, parentId: string | null): Promise<{ id: string }> {
  const { ambiente, aluno, aula } = await resolveAulaAccess(slug, aulaId, alunoId);
  const since = new Date(Date.now() - 60_000);
  const recent = await db.select({ id: aulaComentarios.id }).from(aulaComentarios).where(and(eq(aulaComentarios.alunoId, aluno.id), eq(aulaComentarios.status, "ativo"), gte(aulaComentarios.criadoEm, since)));

  if (recent.length >= 5) {
    throw new AlunoAulaComentarioRateLimitError("Você está comentando rápido demais. Aguarde alguns segundos.");
  }

  const [created] = await db.insert(aulaComentarios).values({ aulaId: aula.id, ambienteId: ambiente.id, alunoId: aluno.id, parentId, conteudo: conteudo.trim() }).$returningId();
  await db.insert(logsAuditoria).values({ ambienteId: ambiente.id, acao: "comentario.criado", entidade: "aula_comentarios", entidadeId: created!.id, dadosNovos: { aulaId: aula.id, alunoId: aluno.id, parentId } });
  return { id: created!.id };
}

export async function removeAlunoAulaComentario(slug: string, aulaId: string, comentarioId: string, alunoId: string): Promise<{ ok: true }> {
  const { ambiente, aluno, aula } = await resolveAulaAccess(slug, aulaId, alunoId);
  const [comentario] = await db.select({ id: aulaComentarios.id, aulaId: aulaComentarios.aulaId, alunoId: aulaComentarios.alunoId, status: aulaComentarios.status }).from(aulaComentarios).where(eq(aulaComentarios.id, comentarioId)).limit(1);

  if (!comentario || comentario.aulaId !== aula.id || comentario.status !== "ativo") {
    throw new AlunoAulaComentarioNotFoundError(`Comentário não encontrado: ${comentarioId}`);
  }
  if (comentario.alunoId !== aluno.id) {
    throw new AlunoAulaComentarioForbiddenError(`Aluno ${aluno.id} sem permissão para remover comentário ${comentarioId}`);
  }

  await db.update(aulaComentarios).set({ status: "removido", atualizadoEm: new Date() }).where(eq(aulaComentarios.id, comentarioId));
  await db.insert(logsAuditoria).values({ ambienteId: ambiente.id, acao: "comentario.removido", entidade: "aula_comentarios", entidadeId: comentarioId });
  return { ok: true };
}

export async function toggleAlunoAulaComentarioCurtida(slug: string, aulaId: string, comentarioId: string, alunoId: string): Promise<{ liked: boolean }> {
  const { ambiente, aluno, aula } = await resolveAulaAccess(slug, aulaId, alunoId);
  const [comentario] = await db.select({ id: aulaComentarios.id, aulaId: aulaComentarios.aulaId, status: aulaComentarios.status }).from(aulaComentarios).where(eq(aulaComentarios.id, comentarioId)).limit(1);

  if (!comentario || comentario.aulaId !== aula.id || comentario.status !== "ativo") {
    throw new AlunoAulaComentarioNotFoundError(`Comentário não encontrado: ${comentarioId}`);
  }

  const [existing] = await db.select({ id: aulaComentarioCurtidas.id }).from(aulaComentarioCurtidas).where(and(eq(aulaComentarioCurtidas.comentarioId, comentarioId), eq(aulaComentarioCurtidas.alunoId, aluno.id))).limit(1);
  if (existing) {
    await db.delete(aulaComentarioCurtidas).where(eq(aulaComentarioCurtidas.id, existing.id));
    await db.insert(logsAuditoria).values({ ambienteId: ambiente.id, acao: "comentario.descurtido", entidade: "aula_comentarios", entidadeId: comentarioId });
    return { liked: false };
  }

  await db.insert(aulaComentarioCurtidas).values({ comentarioId, alunoId: aluno.id });
  await db.insert(logsAuditoria).values({ ambienteId: ambiente.id, acao: "comentario.curtido", entidade: "aula_comentarios", entidadeId: comentarioId });
  return { liked: true };
}
