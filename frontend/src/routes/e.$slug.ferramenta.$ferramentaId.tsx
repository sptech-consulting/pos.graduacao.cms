import { createFileRoute, redirect, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getApiUser, signOutWithApi } from "@/lib/backend-auth";
import { getFerramentaDetalhe, type FerramentaDetalhe } from "@/lib/ferramenta.functions";
import { getAmbienteBranding } from "@/lib/ambiente.functions";
import { ArrowLeft, ExternalLink, Plus, Minus, ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from "lucide-react";

export const Route = createFileRoute("/e/$slug/ferramenta/$ferramentaId")({
  beforeLoad: async ({ params }) => {
    const user = await getApiUser();
    if (!user || user.role !== "aluno" || user.status !== "ativo") {
      throw redirect({ to: "/e/$slug/entrar", params: { slug: params.slug } });
    }
  },
  component: FerramentaPage,
});

function FerramentaPage() {
  const { slug, ferramentaId } = Route.useParams();
  const fetchDetalhe = useServerFn(getFerramentaDetalhe);
  const fetchBranding = useServerFn(getAmbienteBranding);
  const [f, setF] = useState<FerramentaDetalhe | null>(null);
  const [branding, setBranding] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [funcAberta, setFuncAberta] = useState<string | null>(null);
  const casosScrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [d, b] = await Promise.all([
          fetchDetalhe({ data: { slug, ferramentaId } }),
          fetchBranding({ data: { slug } }),
        ]);
        setF(d);
        setBranding(b);
        if (d.funcionalidades.length > 0) setFuncAberta(d.funcionalidades[0].id);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Erro";
        if (/unauthorized|no authorization header|acesso negado|aluno não cadastrado|aluno nao cadastrado/i.test(msg)) {
          await signOutWithApi();
          window.location.href = `/e/${slug}/entrar`;
          return;
        }
        setError(msg);
      }
    })();
  }, [slug, ferramentaId, fetchDetalhe, fetchBranding]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-black text-secondary">Ferramenta não encontrada</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link to="/e/$slug" params={{ slug }} className="mt-6 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground">
            <ArrowLeft className="h-4 w-4" /> Voltar
          </Link>
        </div>
      </div>
    );
  }
  if (!f) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  const cor_fundo = branding?.cor_fundo ?? "#F4F4F2";
  const cor_texto = branding?.cor_texto ?? "#1F2A44";
  const cor_primaria = branding?.cor_primaria ?? "#ED145B";
  const cor_botao = branding?.cor_botao ?? cor_primaria;
  const cor_card = branding?.cor_card ?? "#FFFFFF";
  const cor_borda = branding?.cor_borda ?? "#E5E7EB";

  const inputs = f.tags.filter((t) => t.tipo === "input");
  const outputs = f.tags.filter((t) => t.tipo === "output");
  const integracoes = f.tags.filter((t) => t.tipo === "integracao");
  const funcAtiva = f.funcionalidades.find((fn) => fn.id === funcAberta) ?? f.funcionalidades[0];

  const cardStyle: React.CSSProperties = {
    backgroundColor: cor_card,
    boxShadow:
      "0 1px 2px rgba(16,24,40,.04), 0 12px 32px -14px rgba(16,24,40,.18), 0 30px 60px -30px rgba(16,24,40,.12)",
  };
  const tagCls =
    "inline-flex items-center rounded-full text-xs font-medium px-3.5 py-1.5 backdrop-blur-sm transition hover:scale-[1.03]";
  const tagStyle: React.CSSProperties = {
    background: `linear-gradient(135deg, ${cor_primaria}26, ${cor_primaria}12)`,
    color: cor_primaria,
    boxShadow: `inset 0 0 0 1px ${cor_primaria}33`,
  };
  const chevBtn =
    "h-9 w-9 rounded-full flex items-center justify-center transition hover:bg-black/5";
  const chevBtnStyle: React.CSSProperties = { border: `1px solid ${cor_borda}`, color: cor_primaria };

  // Floating decoration images pulled from funcionalidades that have imagens
  const floatImgs = f.funcionalidades.filter((fn) => fn.imagem_url).slice(0, 2);

  const scrollCasos = (dir: -1 | 1) => {
    const el = casosScrollRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };

  // Indexes for funcionalidades navigation
  const funcIdx = Math.max(0, f.funcionalidades.findIndex((fn) => fn.id === funcAberta));
  const navFunc = (dir: -1 | 1) => {
    if (f.funcionalidades.length === 0) return;
    const next = (funcIdx + dir + f.funcionalidades.length) % f.funcionalidades.length;
    setFuncAberta(f.funcionalidades[next].id);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: cor_fundo, color: cor_texto }}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <Link
          to="/e/$slug"
          params={{ slug }}
          className={chevBtn + " mb-6"}
          style={chevBtnStyle}
          aria-label="Voltar"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>

        {/* HERO */}
        <div className="grid md:grid-cols-2 gap-10 items-center mb-16">
          <div>
            <div className="flex items-center gap-3 mb-3">
              {f.icone_url && <img src={f.icone_url} alt="" className="h-8 w-8 object-contain" />}
              <h1 className="text-4xl sm:text-5xl font-medium tracking-tight">{f.nome}</h1>
            </div>
            {f.subtitulo && <p className="text-base opacity-70 mb-8 max-w-md">{f.subtitulo}</p>}
            {f.url && (
              <a
                href={f.url}
                target={f.tipo_abertura === "mesma_aba" ? "_self" : "_blank"}
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm hover:opacity-90 transition"
                style={{ backgroundColor: cor_botao }}
              >
                Acesse aqui <ExternalLink className="h-3.5 w-3.5" />
              </a>
            )}
          </div>
          {f.imagem_capa_url && (
            <img
              src={f.imagem_capa_url}
              alt={f.nome}
              className="w-full rounded-2xl object-cover aspect-[4/3] shadow-lg"
            />
          )}
        </div>

        {/* BLOCOS / TAGS / CASOS DE USO — Bento futurista flutuante */}
        <div className="relative mb-20">
          <div
            aria-hidden
            className="pointer-events-none absolute -inset-10 -z-10 rounded-[3rem] blur-3xl opacity-60"
            style={{
              background: `radial-gradient(60% 50% at 20% 30%, ${cor_primaria}1f, transparent 70%), radial-gradient(50% 40% at 85% 70%, ${cor_botao}1a, transparent 70%)`,
            }}
          />

          <div className="relative grid md:grid-cols-6 auto-rows-[120px] gap-5">
            {f.casos_uso.length > 0 && (
              <div className="rounded-3xl p-7 md:col-span-2 md:row-span-3 flex flex-col relative overflow-hidden" style={cardStyle}>
                <div
                  aria-hidden
                  className="absolute -top-16 -right-16 h-48 w-48 rounded-full opacity-20 blur-2xl"
                  style={{ backgroundColor: cor_primaria }}
                />
                <h3 className="font-semibold mb-5 text-lg relative">Casos de Uso</h3>
                <ul className="space-y-4 text-sm leading-relaxed opacity-85 relative">
                  {f.casos_uso.map((c) => (
                    <li key={c.id} className="flex gap-2">
                      <span style={{ color: cor_primaria }} className="font-bold mt-0.5">▪</span>
                      <span>{c.texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {inputs.length > 0 && (
              <div className="rounded-3xl p-6 md:col-span-2 md:row-span-2" style={cardStyle}>
                <h3 className="font-semibold mb-4 text-base">Formas de Input</h3>
                <div className="flex flex-wrap gap-2">{inputs.map((t) => <span key={t.id} className={tagCls} style={tagStyle}>{t.rotulo}</span>)}</div>
              </div>
            )}

            {outputs.length > 0 && (
              <div className="rounded-3xl p-6 md:col-span-2 md:row-span-2" style={cardStyle}>
                <h3 className="font-semibold mb-4 text-base">Formas de Output</h3>
                <div className="flex flex-wrap gap-2">{outputs.map((t) => <span key={t.id} className={tagCls} style={tagStyle}>{t.rotulo}</span>)}</div>
              </div>
            )}

            {f.blocos[0] && (
              <div className="rounded-3xl p-6 md:col-span-2 md:row-span-2" style={cardStyle}>
                <h3 className="font-semibold mb-2 text-base">{f.blocos[0].titulo}</h3>
                <p className="text-sm opacity-75 whitespace-pre-wrap leading-relaxed">{f.blocos[0].conteudo}</p>
              </div>
            )}

            {integracoes.length > 0 && (
              <div className="rounded-3xl p-6 md:col-span-2 md:row-span-2" style={cardStyle}>
                <h3 className="font-semibold mb-4 text-base">Integrações</h3>
                <div className="flex flex-wrap gap-2">{integracoes.map((t) => <span key={t.id} className={tagCls} style={tagStyle}>{t.rotulo}</span>)}</div>
              </div>
            )}

            {f.blocos.slice(1).map((b) => (
              <div key={b.id} className="rounded-3xl p-6 md:col-span-2 md:row-span-2" style={cardStyle}>
                <h3 className="font-semibold mb-2 text-base">{b.titulo}</h3>
                <p className="text-sm opacity-75 whitespace-pre-wrap leading-relaxed">{b.conteudo}</p>
              </div>
            ))}

            {f.frase_destaque && (
              <div
                className="rounded-3xl px-6 py-7 flex items-center justify-center text-center font-bold uppercase tracking-wider text-sm md:col-span-6 md:row-span-2 relative overflow-hidden"
                style={{
                  background: `linear-gradient(120deg, ${cor_primaria}, ${cor_botao})`,
                  color: "#fff",
                  boxShadow: `0 20px 40px -20px ${cor_primaria}80`,
                }}
              >
                <div
                  aria-hidden
                  className="absolute inset-0 opacity-30 mix-blend-overlay"
                  style={{
                    backgroundImage:
                      "radial-gradient(circle at 20% 30%, rgba(255,255,255,.4), transparent 40%), radial-gradient(circle at 80% 70%, rgba(255,255,255,.3), transparent 40%)",
                  }}
                />
                <span className="relative">{f.frase_destaque}</span>
              </div>
            )}
          </div>

          {floatImgs[0] && (
            <img
              src={floatImgs[0].imagem_url!}
              alt=""
              aria-hidden
              className="hidden md:block absolute pointer-events-none object-cover rounded-2xl"
              style={{
                top: "32%",
                left: "28%",
                width: "180px",
                height: "130px",
                transform: "rotate(-6deg)",
                boxShadow: "0 24px 50px -12px rgba(16,24,40,.35), 0 0 0 6px #fff",
                zIndex: 5,
              }}
            />
          )}
          {floatImgs[1] && (
            <img
              src={floatImgs[1].imagem_url!}
              alt=""
              aria-hidden
              className="hidden md:block absolute pointer-events-none object-cover rounded-2xl"
              style={{
                top: "8%",
                right: "20%",
                width: "150px",
                height: "150px",
                transform: "rotate(5deg)",
                boxShadow: "0 24px 50px -12px rgba(16,24,40,.35), 0 0 0 6px #fff",
                zIndex: 5,
              }}
            />
          )}
        </div>

        {/* FUNCIONALIDADES */}
        {f.funcionalidades.length > 0 && (
          <div className="mb-16">
            <h2 className="text-2xl font-medium mb-6">Funcionalidades da Ferramenta</h2>
            <div className="relative">
              {/* Nav chevrons */}
              <div className="hidden md:flex flex-col gap-2 absolute -left-14 top-1/2 -translate-y-1/2">
                <button className={chevBtn} style={chevBtnStyle} onClick={() => navFunc(-1)} aria-label="Anterior">
                  <ChevronUp className="h-4 w-4" />
                </button>
                <button className={chevBtn} style={chevBtnStyle} onClick={() => navFunc(1)} aria-label="Próxima">
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
              <div className="rounded-3xl p-6 md:p-8 grid md:grid-cols-2 gap-8 items-start" style={cardStyle}>
                <div className="space-y-3">
                  {f.funcionalidades.map((fn) => {
                    const aberta = fn.id === funcAberta;
                    return (
                      <div
                        key={fn.id}
                        className="rounded-2xl transition"
                        style={{ backgroundColor: aberta ? cor_fundo : "transparent", border: `1px solid ${cor_borda}` }}
                      >
                        <button
                          onClick={() => setFuncAberta(aberta ? null : fn.id)}
                          className="w-full flex items-center gap-3 px-4 py-3 text-left"
                        >
                          <span
                            className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                            style={{ border: `1px solid ${cor_borda}`, color: cor_primaria }}
                          >
                            {aberta ? <Minus className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                          </span>
                          <span className="font-semibold text-sm">{fn.titulo}</span>
                        </button>
                        {aberta && fn.descricao && (
                          <p className="px-4 pb-4 pl-13 text-xs opacity-75 whitespace-pre-wrap leading-relaxed" style={{ paddingLeft: "3.25rem" }}>
                            {fn.descricao}
                          </p>
                        )}
                      </div>
                    );
                  })}
                </div>
                <div>
                  {funcAtiva?.imagem_url ? (
                    <img
                      src={funcAtiva.imagem_url}
                      alt={funcAtiva.titulo}
                      className="w-full rounded-2xl object-cover aspect-[4/3]"
                    />
                  ) : (
                    <div
                      className="w-full aspect-[4/3] rounded-2xl border-2 border-dashed flex items-center justify-center text-xs opacity-50"
                      style={{ borderColor: cor_borda }}
                    >
                      Sem imagem
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* CASOS DE TESTE */}
        {f.casos_teste.length > 0 && (
          <div className="mb-12">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-medium">Casos de Teste</h2>
              <div className="flex gap-2">
                <button className={chevBtn} style={chevBtnStyle} onClick={() => scrollCasos(-1)} aria-label="Anterior">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button className={chevBtn} style={chevBtnStyle} onClick={() => scrollCasos(1)} aria-label="Próximo">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
            <div
              ref={casosScrollRef}
              className="flex gap-4 overflow-x-auto scroll-smooth snap-x snap-mandatory pb-2 -mx-1 px-1"
              style={{ scrollbarWidth: "none" }}
            >
              {f.casos_teste.map((c) => (
                <div
                  key={c.id}
                  className="rounded-2xl p-6 flex-shrink-0 snap-start w-[280px] sm:w-[320px]"
                  style={cardStyle}
                >
                  <div className="flex items-start justify-between mb-3 gap-2">
                    <h3 className="font-semibold text-base">{c.titulo}</h3>
                    <span
                      className="h-6 w-6 rounded-full flex items-center justify-center flex-shrink-0"
                      style={{ border: `1px solid ${cor_borda}`, color: cor_primaria }}
                    >
                      <Plus className="h-3 w-3" />
                    </span>
                  </div>
                  {c.badge && (
                    <div className="text-[10px] font-bold uppercase tracking-wider opacity-60 mb-2" style={{ color: cor_primaria }}>
                      {c.badge}
                    </div>
                  )}
                  {c.prompt_exemplo && (
                    <div className="border-l-2 pl-3 text-sm mb-3 opacity-90" style={{ borderColor: cor_primaria }}>
                      {c.prompt_exemplo}
                    </div>
                  )}
                  {c.explicacao && <p className="text-xs opacity-70 whitespace-pre-wrap leading-relaxed">{c.explicacao}</p>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
