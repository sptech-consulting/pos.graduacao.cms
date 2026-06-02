import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getApiUser } from "@/lib/backend-auth";
import { getNovidadeDetalhe, type NovidadeDetalhe } from "@/lib/novidade.functions";
import { getAmbienteBranding } from "@/lib/ambiente.functions";
import { ArrowLeft, ExternalLink, Calendar } from "lucide-react";

export const Route = createFileRoute("/e/$slug/novidade/$novidadeId")({
  beforeLoad: async ({ params }) => {
    const user = await getApiUser();
    if (!user || user.role !== "aluno" || user.status !== "ativo") {
      throw redirect({ to: "/e/$slug/entrar", params: { slug: params.slug } });
    }
  },
  component: NovidadePage,
});

function NovidadePage() {
  const { slug, novidadeId } = Route.useParams();
  const fetchDetalhe = useServerFn(getNovidadeDetalhe);
  const fetchBranding = useServerFn(getAmbienteBranding);
  const [n, setN] = useState<NovidadeDetalhe | null>(null);
  const [branding, setBranding] = useState<{ cor_primaria?: string; cor_secundaria?: string; cor_fundo?: string; cor_texto?: string; cor_card?: string; cor_borda?: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [d, b] = await Promise.all([
          fetchDetalhe({ data: { slug, novidadeId } }),
          fetchBranding({ data: { slug } }),
        ]);
        setN(d);
        setBranding(b as never);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao carregar");
      }
    })();
  }, [slug, novidadeId, fetchDetalhe, fetchBranding]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-black text-secondary">Novidade não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link
            to="/e/$slug"
            params={{ slug }}
            className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </div>
    );
  }

  if (!n) {
    return <div className="p-8 text-muted-foreground">Carregando…</div>;
  }

  const cor_fundo = branding?.cor_fundo ?? "#FFFFFF";
  const cor_texto = branding?.cor_texto ?? "#1F2A44";
  const cor_primaria = branding?.cor_primaria ?? "#ED145B";
  const cor_card = branding?.cor_card ?? "#FFFFFF";
  const cor_borda = branding?.cor_borda ?? "#D0D3D4";

  return (
    <div className="min-h-screen" style={{ backgroundColor: cor_fundo, color: cor_texto }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
        <Link
          to="/e/$slug"
          params={{ slug }}
          className="inline-flex items-center gap-1.5 text-sm font-semibold mb-6 hover:underline"
          style={{ color: cor_primaria }}
        >
          <ArrowLeft className="h-4 w-4" /> Voltar para novidades
        </Link>

        <article
          className="rounded-2xl overflow-hidden border"
          style={{ backgroundColor: cor_card, borderColor: cor_borda }}
        >
          {n.imagem_url && (
            <img src={n.imagem_url} alt={n.titulo} className="w-full h-64 sm:h-80 object-cover" />
          )}
          <div className="p-6 sm:p-8">
            {n.categoria && (
              <span
                className="inline-block text-[10px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full mb-3"
                style={{ backgroundColor: cor_primaria + "22", color: cor_primaria }}
              >
                {n.categoria}
              </span>
            )}
            <h1 className="text-2xl sm:text-3xl font-black leading-tight">{n.titulo}</h1>
            <div className="mt-3 flex items-center gap-3 text-xs opacity-70">
              {n.publicado_em && (
                <span className="inline-flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {new Date(n.publicado_em).toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              )}
              {n.fonte_nome && <span>· {n.fonte_nome}</span>}
            </div>

            {n.resumo && (
              <p className="mt-6 text-base sm:text-lg leading-relaxed opacity-90">{n.resumo}</p>
            )}

            {n.conteudo && (
              <div
                className="mt-6 prose prose-sm sm:prose-base max-w-none leading-relaxed whitespace-pre-wrap"
                style={{ color: cor_texto }}
              >
                {n.conteudo}
              </div>
            )}

            <div className="mt-8 flex flex-wrap items-center gap-3 pt-6 border-t" style={{ borderColor: cor_borda }}>
              {n.fonte_url && (
                <a
                  href={n.fonte_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold text-white"
                  style={{ backgroundColor: cor_primaria }}
                >
                  Ler na fonte original <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
              <Link
                to="/e/$slug"
                params={{ slug }}
                className="inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold"
                style={{ borderColor: cor_borda, color: cor_texto }}
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Voltar
              </Link>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
