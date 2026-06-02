import { and, desc, eq, inArray, isNull, lte, or } from "drizzle-orm";
import { db } from "../db/connection.js";
import {
  ambienteAlunos,
  ambienteCursos,
  ambienteFerramentas,
  ambientes,
  alunos,
  aulas,
  cursos,
  ferramentas,
  modulos,
  novidades,
} from "../db/schema/index.js";

export class AlunoHomeAmbienteNotFoundError extends Error {
  constructor(slug: string) {
    super(`Ambiente não encontrado ou inativo: ${slug}`);
    this.name = "AlunoHomeAmbienteNotFoundError";
  }
}

export class AlunoHomeAlunoNotFoundError extends Error {
  constructor(alunoId: string) {
    super(`Aluno não cadastrado ou inativo: ${alunoId}`);
    this.name = "AlunoHomeAlunoNotFoundError";
  }
}

export class AlunoHomeAccessDeniedError extends Error {
  constructor(alunoId: string, slug: string) {
    super(`Aluno ${alunoId} sem acesso a este ambiente: ${slug}`);
    this.name = "AlunoHomeAccessDeniedError";
  }
}

export async function getAlunoAmbienteHome(slug: string, alunoId: string) {
  const [ambiente] = await db
    .select()
    .from(ambientes)
    .where(and(eq(ambientes.slug, slug), eq(ambientes.status, "ativo")))
    .limit(1);

  if (!ambiente) {
    throw new AlunoHomeAmbienteNotFoundError(slug);
  }

  const [aluno] = await db
    .select({ id: alunos.id, nomeCompleto: alunos.nomeCompleto, emailAcesso: alunos.emailAcesso, status: alunos.status })
    .from(alunos)
    .where(eq(alunos.id, alunoId))
    .limit(1);

  if (!aluno || aluno.status !== "ativo") {
    throw new AlunoHomeAlunoNotFoundError(alunoId);
  }

  const [vinculo] = await db
    .select({ id: ambienteAlunos.id })
    .from(ambienteAlunos)
    .where(
      and(
        eq(ambienteAlunos.ambienteId, ambiente.id),
        eq(ambienteAlunos.alunoId, aluno.id),
        eq(ambienteAlunos.status, "ativo"),
      ),
    )
    .limit(1);

  if (!vinculo) {
    throw new AlunoHomeAccessDeniedError(alunoId, slug);
  }

  const ferramentasVinculadas = await db
    .select({ ferramentaId: ambienteFerramentas.ferramentaId, ordem: ambienteFerramentas.ordem, destaque: ambienteFerramentas.destaque })
    .from(ambienteFerramentas)
    .where(and(eq(ambienteFerramentas.ambienteId, ambiente.id), eq(ambienteFerramentas.status, "ativo")));

  const ferramentaIds = ferramentasVinculadas.map((item) => item.ferramentaId);
  const ferramentasRows = ferramentaIds.length
    ? await db
        .select({
          id: ferramentas.id,
          nome: ferramentas.nome,
          descricao: ferramentas.descricao,
          url: ferramentas.url,
          iconeUrl: ferramentas.iconeUrl,
          categoria: ferramentas.categoria,
          tipoAbertura: ferramentas.tipoAbertura,
        })
        .from(ferramentas)
        .where(and(inArray(ferramentas.id, ferramentaIds), eq(ferramentas.status, "ativo")))
    : [];

  const novidadesRows = await db
    .select({
      id: novidades.id,
      titulo: novidades.titulo,
      resumo: novidades.resumo,
      imagemUrl: novidades.imagemUrl,
      fonteNome: novidades.fonteNome,
      fonteUrl: novidades.fonteUrl,
      categoria: novidades.categoria,
      publicadoEm: novidades.publicadoEm,
    })
    .from(novidades)
    .where(and(eq(novidades.ambienteId, ambiente.id), eq(novidades.status, "publicada")))
    .orderBy(desc(novidades.publicadoEm), desc(novidades.criadoEm));

  const now = new Date();
  const cursosVinculados = await db
    .select({ cursoId: ambienteCursos.cursoId, ordem: ambienteCursos.ordem, destaque: ambienteCursos.destaque })
    .from(ambienteCursos)
    .where(
      and(
        eq(ambienteCursos.ambienteId, ambiente.id),
        eq(ambienteCursos.status, "ativo"),
        eq(ambienteCursos.liberado, true),
        or(isNull(ambienteCursos.dataLiberacao), lte(ambienteCursos.dataLiberacao, now)),
      ),
    );

  const cursoIds = [...new Set(cursosVinculados.map((item) => item.cursoId))];
  const cursosRows = cursoIds.length
    ? await db
        .select({
          id: cursos.id,
          titulo: cursos.titulo,
          descricao: cursos.descricao,
          capaUrl: cursos.capaUrl,
          categoria: cursos.categoria,
          nivel: cursos.nivel,
        })
        .from(cursos)
        .where(and(inArray(cursos.id, cursoIds), eq(cursos.status, "publicada")))
    : [];

  const modulosRows = cursoIds.length
    ? await db
        .select({ id: modulos.id, cursoId: modulos.cursoId, titulo: modulos.titulo, ordem: modulos.ordem })
        .from(modulos)
        .where(and(inArray(modulos.cursoId, cursoIds), eq(modulos.status, "ativo")))
    : [];

  const moduloIds = modulosRows.map((item) => item.id);
  const aulasRows = moduloIds.length
    ? await db
        .select({
          id: aulas.id,
          titulo: aulas.titulo,
          descricao: aulas.descricao,
          videoUrl: aulas.videoUrl,
          materialUrl: aulas.materialUrl,
          thumbnailUrl: aulas.thumbnailUrl,
          duracaoMinutos: aulas.duracaoMinutos,
          tipoConteudo: aulas.tipoConteudo,
          ordem: aulas.ordem,
          moduloTitulo: modulos.titulo,
          moduloOrdem: modulos.ordem,
          cursoId: modulos.cursoId,
        })
        .from(aulas)
        .innerJoin(modulos, eq(aulas.moduloId, modulos.id))
        .where(and(inArray(aulas.moduloId, moduloIds), eq(aulas.status, "publicada")))
    : [];

  const ferramentaById = new Map(ferramentasRows.map((item) => [item.id, item]));
  const cursoOrdem = new Map(cursosVinculados.map((item) => [item.cursoId, item.ordem ?? 0]));
  const cursoDestaque = new Map(cursosVinculados.map((item) => [item.cursoId, !!item.destaque]));

  const aulasNormalizadas = aulasRows
    .map((item) => ({
      id: item.id,
      slug: null,
      titulo: item.titulo,
      descricao: item.descricao,
      modulo: item.moduloTitulo,
      videoUrl: item.videoUrl,
      materialUrl: item.materialUrl,
      thumbnailUrl: item.thumbnailUrl,
      duracaoMinutos: item.duracaoMinutos,
      tipoConteudo: item.tipoConteudo,
      moduloOrdem: (cursoOrdem.get(item.cursoId) ?? 0) * 1000 + (item.moduloOrdem ?? 0),
      ordem: item.ordem ?? 0,
      cursoId: item.cursoId,
    }))
    .sort((a, b) => a.moduloOrdem - b.moduloOrdem || a.ordem - b.ordem);

  const aulasPorCurso = new Map<string, Array<{ id: string; slug: string | null }>>();
  for (const aula of aulasNormalizadas) {
    const list = aulasPorCurso.get(aula.cursoId) ?? [];
    list.push({ id: aula.id, slug: aula.slug });
    aulasPorCurso.set(aula.cursoId, list);
  }

  return {
    branding: {
      id: ambiente.id,
      nome: ambiente.nome,
      slug: ambiente.slug,
      descricao: ambiente.descricao,
      logoUrl: ambiente.logoUrl,
      imagemCapaUrl: ambiente.imagemCapaUrl,
      corPrimaria: ambiente.corPrimaria ?? "#ED145B",
      corSecundaria: ambiente.corSecundaria ?? "#1F2A44",
      corFundo: ambiente.corFundo ?? "#FFFFFF",
      corTexto: ambiente.corTexto ?? "#1F2A44",
      corBotao: ambiente.corBotao ?? "#ED145B",
      corCard: ambiente.corCard ?? "#FFFFFF",
      corBorda: ambiente.corBorda ?? "#D0D3D4",
      cardEstilo: ambiente.cardEstilo ?? "sombra",
      cardBorda: ambiente.cardBorda ?? "arredondado",
      cardTamanho: ambiente.cardTamanho ?? "medio",
      cardSombra: ambiente.cardSombra ?? true,
      cardExibirIcone: ambiente.cardExibirIcone ?? true,
      cardExibirImagem: ambiente.cardExibirImagem ?? true,
      efeitoCardTilt3d: !!ambiente.efeitoCardTilt3d,
      efeitoCardGlow: !!ambiente.efeitoCardGlow,
      efeitoCardScale: !!ambiente.efeitoCardScale,
      efeitoBotaoLift: !!ambiente.efeitoBotaoLift,
      efeitoEntradaAnimada: !!ambiente.efeitoEntradaAnimada,
      efeitoSomHover: !!ambiente.efeitoSomHover,
      efeitoSomVolume: ambiente.efeitoSomVolume ?? 40,
      efeitoBlobsFundo: !!ambiente.efeitoBlobsFundo,
      tema: ambiente.tema === "escuro" ? "escuro" : "claro",
      playbookTitulo: ambiente.playbookTitulo,
      playbookDescricao: ambiente.playbookDescricao,
      playbookCapaUrl: ambiente.playbookCapaUrl,
      playbookArquivoUrl: ambiente.playbookArquivoUrl,
    },
    aluno: {
      id: aluno.id,
      nomeCompleto: aluno.nomeCompleto,
      emailAcesso: aluno.emailAcesso,
    },
    ferramentas: ferramentasVinculadas
      .filter((item) => ferramentaById.has(item.ferramentaId))
      .sort((a, b) => (a.ordem ?? 0) - (b.ordem ?? 0))
      .map((item) => {
        const ferramenta = ferramentaById.get(item.ferramentaId)!;
        return {
          id: ferramenta.id,
          slug: null,
          nome: ferramenta.nome,
          descricao: ferramenta.descricao,
          url: ferramenta.url,
          iconeUrl: ferramenta.iconeUrl,
          categoria: ferramenta.categoria,
          tipoAbertura: ferramenta.tipoAbertura,
          destaque: !!item.destaque,
        };
      }),
    novidades: novidadesRows.map((item) => ({
      id: item.id,
      slug: null,
      titulo: item.titulo,
      resumo: item.resumo,
      imagemUrl: item.imagemUrl,
      fonteNome: item.fonteNome,
      fonteUrl: item.fonteUrl,
      categoria: item.categoria,
      publicadoEm: item.publicadoEm ? item.publicadoEm.toISOString() : null,
      destaque: false,
    })),
    aulas: aulasNormalizadas.map((item) => ({
      id: item.id,
      slug: item.slug,
      titulo: item.titulo,
      descricao: item.descricao,
      modulo: item.modulo,
      videoUrl: item.videoUrl,
      materialUrl: item.materialUrl,
      thumbnailUrl: item.thumbnailUrl,
      duracaoMinutos: item.duracaoMinutos,
      tipoConteudo: item.tipoConteudo,
      moduloOrdem: item.moduloOrdem,
      ordem: item.ordem,
    })),
    cursos: cursosRows
      .map((item) => {
        const aulasDoCurso = aulasPorCurso.get(item.id) ?? [];
        return {
          id: item.id,
          titulo: item.titulo,
          descricao: item.descricao,
          capaUrl: item.capaUrl,
          categoria: item.categoria,
          nivel: item.nivel,
          totalAulas: aulasDoCurso.length,
          primeiraAulaId: aulasDoCurso[0]?.id ?? null,
          primeiraAulaSlug: aulasDoCurso[0]?.slug ?? null,
          ordem: cursoOrdem.get(item.id) ?? 0,
          destaque: cursoDestaque.get(item.id) ?? false,
        };
      })
      .sort((a, b) => a.ordem - b.ordem),
  };
}
