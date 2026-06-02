import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  checkAlunoAmbienteAccessApi,
  ensureAlunoAuthLinkApi,
  listAlunoAmbientesApi,
} from "./aluno.api";

/**
 * Após o login do aluno, vincula auth.uid() ao registro public.alunos
 * pelo email_acesso (case-insensitive), se ainda não estiver vinculado.
 * Retorna o aluno (ou null se não houver pré-cadastro).
 */
export const ensureAlunoAuthLink = createServerFn({ method: "POST" })
  .handler(async () => ensureAlunoAuthLinkApi());

/**
 * Confere se o aluno autenticado tem acesso ativo ao ambiente (slug).
 */
export const checkAlunoAmbienteAccess = createServerFn({ method: "POST" })
  .inputValidator((input) =>
    z.object({ slug: z.string().min(1).max(120) }).parse(input),
  )
  .handler(async ({ data }) => checkAlunoAmbienteAccessApi(data.slug));

/**
 * Retorna o aluno autenticado + lista de ambientes ativos vinculados a ele.
 * Usa supabaseAdmin para não depender de RLS / timing do JWT no browser.
 */
export const listarAmbientesDoAluno = createServerFn({ method: "POST" })
  .handler(async () => {
    const payload = await listAlunoAmbientesApi();
    return {
      aluno: payload.aluno
        ? { nome_completo: payload.aluno.nomeCompleto, email_acesso: payload.aluno.emailAcesso }
        : null,
      ambientes: payload.ambientes.map((ambiente) => ({
        id: ambiente.id,
        nome: ambiente.nome,
        slug: ambiente.slug,
        cor_primaria: ambiente.corPrimaria,
        imagem_capa_url: ambiente.imagemCapaUrl,
      })),
    };
  });
