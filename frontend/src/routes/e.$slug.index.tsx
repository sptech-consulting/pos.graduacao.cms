import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getApiUser, signOutWithApi } from "@/lib/backend-auth";
import { signOut } from "@/lib/auth";
import { getAmbienteHome, type AmbienteHomeData, type FerramentaItem } from "@/lib/ambiente-home.functions";
import { EffectCard } from "@/components/EffectCard";
import { DEFAULT_EFFECTS, type AmbienteEffects } from "@/lib/ambiente-effects";
import {
  Wrench,
  Newspaper,
  GraduationCap,
  ExternalLink,
  PlayCircle,
  FileText,
  Download,
  Sparkles,
  LogOut,
  Sun,
  Moon,
  Volume2,
  VolumeX,
  ChevronRight,
  ChevronLeft,
  BookOpen,
} from "lucide-react";

export const Route = createFileRoute("/e/$slug/")({
  beforeLoad: async ({ params }) => {
    const user = await getApiUser();
    if (!user || user.role !== "aluno" || user.status !== "ativo") {
      throw redirect({ to: "/e/$slug/entrar", params: { slug: params.slug } });
    }
  },
  component: AmbienteHome,
});

const RADII = {
  quadrado: "0px",
  levemente_arredondado: "6px",
  arredondado: "16px",
  pill: "9999px",
} as const;

const PAD = { compacto: "14px", medio: "20px", grande: "26px" } as const;

type SectionKey = "ferramentas" | "novidades" | "playbook" | "cursos";

function AmbienteHome() {
  const { slug } = Route.useParams();
  const navigate = useNavigate();
  const fetchHome = useServerFn(getAmbienteHome);
  const [data, setData] = useState<AmbienteHomeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [theme, setTheme] = useState<"claro" | "escuro">("claro");
  const [muted, setMuted] = useState(false);
  const [active, setActive] = useState<SectionKey>("ferramentas");

  useEffect(() => {
    (async () => {
      try {
        const res = await fetchHome({ data: { slug } });
        setData(res);
        const savedTheme = localStorage.getItem(`amb:${slug}:theme`) as "claro" | "escuro" | null;
        setTheme(savedTheme ?? (res.branding.tema as "claro" | "escuro"));
        setMuted(localStorage.getItem(`amb:${slug}:muted`) === "1");
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao carregar ambiente";
        if (/unauthorized|no authorization header|acesso negado|aluno não cadastrado|aluno nao cadastrado/i.test(msg)) {
          await signOutWithApi();
          navigate({ to: "/e/$slug/entrar", params: { slug }, replace: true });
          return;
        }
        setError(msg);
      }
    })();
  }, [slug, fetchHome, navigate]);

  useEffect(() => {
    if (data) localStorage.setItem(`amb:${slug}:theme`, theme);
  }, [theme, slug, data]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-6 text-center">
        <div className="max-w-md rounded-xl border border-border bg-card p-8">
          <h1 className="text-xl font-black text-secondary">Acesso indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <button
            onClick={async () => {
              await signOut();
              window.location.assign(`/e/${slug}/login`);
            }}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  if (!data) {
    return <div className="min-h-screen flex items-center justify-center text-muted-foreground text-sm">Carregando…</div>;
  }

  const b = data.branding;
  const isDark = theme === "escuro";
  const radius = RADII[b.card_borda];
  const padding = PAD[b.card_tamanho];

  // tokens efetivos respeitando o tema
  const tk = {
    bg: isDark ? "#0a0a0f" : b.cor_fundo,
    text: isDark ? "#f4f4f5" : b.cor_texto,
    card: isDark ? "rgba(255,255,255,0.05)" : b.cor_card,
    border: isDark ? "rgba(255,255,255,0.10)" : b.cor_borda,
    navBg: isDark ? "rgba(20,20,28,0.78)" : "rgba(255,255,255,0.78)",
    navText: isDark ? "#f4f4f5" : b.cor_secundaria,
    primaria: b.cor_primaria,
    secundaria: b.cor_secundaria,
    botao: b.cor_botao,
  };

  const effects: AmbienteEffects = {
    ...DEFAULT_EFFECTS,
    efeito_card_tilt_3d: b.efeito_card_tilt_3d,
    efeito_card_glow: b.efeito_card_glow,
    efeito_card_scale: b.efeito_card_scale,
    efeito_botao_lift: b.efeito_botao_lift,
    efeito_entrada_animada: b.efeito_entrada_animada,
    efeito_som_hover: b.efeito_som_hover && !muted,
    efeito_som_volume: b.efeito_som_volume,
    efeito_blobs_fundo: b.efeito_blobs_fundo,
  };

  const shadow = b.card_estilo === "sombra" || b.card_sombra
    ? isDark
      ? "0 10px 30px -12px rgba(0,0,0,0.7)"
      : "0 10px 24px -12px rgba(0,0,0,0.25)"
    : "none";
  const cardBorder = b.card_estilo === "borda" ? `1px solid ${tk.border}` : "none";

  const cardBase: React.CSSProperties = {
    backgroundColor: b.card_estilo === "imagem" ? "transparent" : tk.card,
    color: tk.text,
    borderRadius: radius,
    padding,
    boxShadow: shadow,
    border: cardBorder,
    backgroundImage:
      b.card_estilo === "imagem"
        ? "linear-gradient(135deg, rgba(0,0,0,0.55), rgba(0,0,0,0.15)), linear-gradient(135deg, var(--cp), var(--cs))"
        : undefined,
  };

  const enterClass = effects.efeito_entrada_animada ? "fx-enter" : "";
  const btnLift = effects.efeito_botao_lift ? "fx-btn-lift" : "";

  const aulasComMaterial = data.aulas.filter((a) => !!a.material_url);
  const hasPlaybook = !!data.branding.playbook_arquivo_url;
  const playbookCount = (hasPlaybook ? 1 : 0) + aulasComMaterial.length;
  const sections: { key: SectionKey; label: string; icon: React.ReactNode; count: number }[] = [
    { key: "ferramentas", label: "Ferramentas", icon: <Wrench className="h-3.5 w-3.5" />, count: data.ferramentas.length },
    { key: "novidades", label: "Novidades", icon: <Newspaper className="h-3.5 w-3.5" />, count: data.novidades.length },
    { key: "playbook", label: "Playbook", icon: <BookOpen className="h-3.5 w-3.5" />, count: playbookCount },
    { key: "cursos", label: "Cursos", icon: <GraduationCap className="h-3.5 w-3.5" />, count: data.cursos.length },
  ];

  function openFerramenta(f: FerramentaItem) {
    navigate({ to: "/e/$slug/ferramenta/$ferramentaId", params: { slug, ferramentaId: f.slug ?? f.id } });
  }

  return (
    <div
      key={`${theme}`}
      className="min-h-screen relative overflow-x-hidden"
      style={
        {
          backgroundColor: tk.bg,
          color: tk.text,
          ["--cp" as any]: tk.primaria,
          ["--cs" as any]: tk.secundaria,
          ["--blob-1" as any]: tk.primaria,
          ["--blob-2" as any]: tk.secundaria,
          transition: "background-color .5s cubic-bezier(.16,1,.3,1), color .5s",
        } as React.CSSProperties
      }
    >
      {effects.efeito_blobs_fundo && <div className="fx-blobs pointer-events-none" />}

      {/* Floating nav */}
      <nav
        className="fixed bottom-3 left-1/2 -translate-x-1/2 sm:bottom-auto sm:top-3 z-40 px-2 py-1.5 backdrop-blur-md flex items-center gap-1 shadow-lg max-w-[calc(100vw-1.5rem)] overflow-x-auto"
        style={{
          backgroundColor: tk.navBg,
          color: tk.navText,
          borderRadius: 9999,
          border: `1px solid ${tk.border}`,
        }}
      >
        {sections.map((s) => {
          const isActive = active === s.key;
          return (
            <button
              key={s.key}
              onClick={() => {
                setActive(s.key);
                document.getElementById(`sec-${s.key}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
              className={`relative px-3 py-1.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider rounded-full transition-all flex items-center gap-1.5 ${btnLift}`}
              style={{
                backgroundColor: isActive ? tk.primaria : "transparent",
                color: isActive ? "#fff" : tk.navText,
              }}
            >
              {s.icon}
              <span className="hidden sm:inline">{s.label}</span>
              {s.count > 0 && (
                <span
                  className="ml-1 text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                  style={{
                    backgroundColor: isActive ? "rgba(255,255,255,.25)" : tk.primaria + "22",
                    color: isActive ? "#fff" : tk.primaria,
                  }}
                >
                  {s.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Top-right controls */}
      <div className="fixed top-3 right-3 z-40 flex items-center gap-2">
        {b.efeito_som_hover && (
          <IconToggle
            onClick={() => {
              const next = !muted;
              setMuted(next);
              localStorage.setItem(`amb:${slug}:muted`, next ? "1" : "0");
            }}
            tk={tk}
            title={muted ? "Som desligado" : "Som ligado"}
          >
            {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
          </IconToggle>
        )}
        <IconToggle
          onClick={() => setTheme((t) => (t === "claro" ? "escuro" : "claro"))}
          tk={tk}
          title={isDark ? "Tema claro" : "Tema escuro"}
        >
          {isDark ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        </IconToggle>
        <button
          onClick={() => navigate({ to: "/e/$slug/resultados", params: { slug } })}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-2 rounded-full ${btnLift}`}
          style={{ backgroundColor: tk.primaria, color: "#fff" }}
          title="Mural de Resultados"
        >
          <Sparkles className="h-3 w-3" /> <span className="hidden sm:inline">Resultados</span>
        </button>
        <button
          onClick={async () => {
            await signOut();
            window.location.assign(`/e/${slug}/login`);
          }}
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-3 py-2 rounded-full ${btnLift}`}
          style={{ backgroundColor: tk.botao, color: "#fff" }}
        >
          <LogOut className="h-3 w-3" /> <span className="hidden sm:inline">Sair</span>
        </button>
      </div>

      <main className="relative z-10 mx-auto max-w-[1400px] px-5 sm:px-8 pt-24 pb-32 space-y-16">
        {/* Hero */}
        <header className="text-center pt-6 sm:pt-12">
          <div className="inline-flex items-center gap-2 mb-5">
            {b.logo_url ? (
              <img src={b.logo_url} alt={b.nome} className="h-9 w-auto" />
            ) : (
              <div className="h-9 w-9 rounded-md" style={{ backgroundColor: tk.primaria }} />
            )}
          </div>
          <div
            className="text-[11px] uppercase tracking-[0.3em] font-bold mb-3"
            style={{ color: tk.primaria }}
          >
            Olá, {data.aluno.nome_completo.split(" ")[0]}
          </div>
          <h1
            className="text-4xl sm:text-6xl font-black leading-[0.95] tracking-tight"
            style={{
              backgroundImage: `linear-gradient(135deg, ${tk.primaria}, ${tk.secundaria})`,
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            {b.nome}
          </h1>
          {b.descricao && (
            <p className="mt-4 mx-auto max-w-xl text-sm sm:text-base opacity-70">{b.descricao}</p>
          )}
        </header>

        {/* Ferramentas */}
        <Section
          id="sec-ferramentas"
          title="Ferramentas"
          subtitle="Acesse os apps e plataformas do seu programa"
          tk={tk}
          empty={data.ferramentas.length === 0}
          emptyMsg="Nenhuma ferramenta vinculada ainda."
        >
          <Carousel enterClass={enterClass}>
            {data.ferramentas.map((f) => (
              <EffectCard
                key={f.id}
                effects={effects}
                baseStyle={{
                  ...cardBase,
                  cursor: f.url ? "pointer" : "default",
                  width: 300,
                  height: 340,
                  display: "flex",
                  flexDirection: "column",
                }}
                primaria={tk.primaria}
                onClick={() => openFerramenta(f)}
              >
                {b.card_exibir_icone && (
                  <div className="flex items-start justify-between mb-4">
                    {f.icone_url ? (
                      <img src={f.icone_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                    ) : (
                      <div
                        className="h-12 w-12 rounded-lg flex items-center justify-center text-white"
                        style={{ backgroundColor: tk.primaria }}
                      >
                        <Wrench className="h-5 w-5" />
                      </div>
                    )}
                    {f.destaque && (
                      <span
                        className="text-[9px] uppercase tracking-wider font-bold px-2 py-1 rounded-full"
                        style={{ backgroundColor: tk.primaria + "22", color: tk.primaria }}
                      >
                        Destaque
                      </span>
                    )}
                  </div>
                )}
                {f.categoria && (
                  <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{f.categoria}</div>
                )}
                <div className="font-bold text-lg leading-tight line-clamp-2">{f.nome}</div>
                <div className="mt-1.5 text-xs opacity-70 line-clamp-3 min-h-[3em]">
                  {f.descricao ?? ""}
                </div>
                {f.url && (
                  <div
                    className={`mt-auto self-start inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full ${btnLift}`}
                    style={{ backgroundColor: tk.botao, color: "#fff" }}
                  >
                    Acessar <ExternalLink className="h-3 w-3" />
                  </div>
                )}
              </EffectCard>
            ))}
          </Carousel>
        </Section>

        {/* Novidades */}
        <Section
          id="sec-novidades"
          title="Novidades"
          subtitle="O que está acontecendo no mundo da IA"
          tk={tk}
          empty={data.novidades.length === 0}
          emptyMsg="Nenhuma novidade publicada ainda."
        >
          <Carousel enterClass={enterClass}>
            {data.novidades.map((n) => (
              <EffectCard
                key={n.id}
                effects={effects}
                baseStyle={{ ...cardBase, cursor: "pointer", minWidth: 300, maxWidth: 340, padding: 0, overflow: "hidden" }}
                primaria={tk.primaria}
                onClick={() => navigate({ to: "/e/$slug/novidade/$novidadeId", params: { slug, novidadeId: n.slug ?? n.id } })}
              >
                {b.card_exibir_imagem && (
                  <div
                    className="h-40 w-full"
                    style={{
                      backgroundImage: n.imagem_url
                        ? `url(${n.imagem_url})`
                        : `linear-gradient(135deg, ${tk.primaria}, ${tk.secundaria})`,
                      backgroundSize: "cover",
                      backgroundPosition: "center",
                    }}
                  />
                )}
                <div style={{ padding }}>
                  <div className="flex items-center gap-2 mb-1">
                    {n.categoria && (
                      <span
                        className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: tk.primaria + "22", color: tk.primaria }}
                      >
                        {n.categoria}
                      </span>
                    )}
                    {n.destaque && (
                      <span
                        className="text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full"
                        style={{ backgroundColor: tk.primaria, color: "#fff" }}
                      >
                        Destaque
                      </span>
                    )}
                  </div>
                  <div className="font-bold leading-snug line-clamp-2">{n.titulo}</div>
                  {n.resumo && <div className="mt-1.5 text-xs opacity-70 line-clamp-3">{n.resumo}</div>}
                  <div className="mt-3 flex items-center justify-between text-[10px] opacity-60">
                    <span>
                      {n.publicado_em
                        ? new Date(n.publicado_em).toLocaleDateString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : ""}
                    </span>
                    {n.fonte_nome && <span>{n.fonte_nome}</span>}
                  </div>
                </div>
              </EffectCard>
            ))}
          </Carousel>
        </Section>

        {/* Playbook */}
        <Section
          id="sec-playbook"
          title="Playbook"
          subtitle={hasPlaybook ? "O playbook deste ambiente e materiais complementares" : "Baixe os materiais complementares das aulas"}
          tk={tk}
          empty={playbookCount === 0}
          emptyMsg="Nenhum material disponível para download ainda."
        >
          {hasPlaybook && (
            <div className="mb-5">
              <div
                className="relative overflow-hidden rounded-2xl border grid grid-cols-1 lg:grid-cols-[1fr_1.2fr]"
                style={{ borderColor: tk.border, backgroundColor: tk.card }}
              >
                {/* Texto + CTA */}
                <div
                  className="relative p-6 sm:p-8 lg:p-10 flex flex-col justify-between order-2 lg:order-1"
                  style={{
                    background: `linear-gradient(135deg, ${tk.primaria}, ${tk.secundaria})`,
                    color: "#fff",
                    minHeight: 240,
                  }}
                >
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold bg-white/15 backdrop-blur rounded-full px-3 py-1 mb-3">
                      <BookOpen className="h-3 w-3" /> Playbook
                    </div>
                    <h3 className="text-2xl sm:text-3xl lg:text-4xl font-black leading-tight">
                      {data.branding.playbook_titulo ?? `Playbook · ${data.branding.nome}`}
                    </h3>
                    {data.branding.playbook_descricao && (
                      <p className="mt-3 text-sm sm:text-base opacity-90 max-w-md">
                        {data.branding.playbook_descricao}
                      </p>
                    )}
                  </div>
                  <div className="mt-6 flex flex-wrap gap-2">
                    <a
                      href={data.branding.playbook_arquivo_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className={`inline-flex items-center gap-2 text-sm font-bold px-5 py-3 rounded-full ${btnLift}`}
                      style={{ backgroundColor: tk.botao, color: "#fff" }}
                    >
                      <Download className="h-4 w-4" /> Baixar Playbook
                    </a>
                  </div>
                </div>

                {/* Capa 16:9 */}
                <div
                  className="relative order-1 lg:order-2 aspect-[16/9] lg:aspect-auto lg:min-h-full bg-center bg-cover"
                  style={{
                    backgroundImage: data.branding.playbook_capa_url
                      ? `url(${data.branding.playbook_capa_url})`
                      : `linear-gradient(135deg, ${tk.secundaria}, ${tk.primaria})`,
                  }}
                  aria-hidden
                />
              </div>
            </div>
          )}

          {aulasComMaterial.length > 0 && (
            <Carousel enterClass={enterClass}>
              {aulasComMaterial.map((a) => (
                <EffectCard
                  key={`pb-${a.id}`}
                  effects={effects}
                  baseStyle={{ ...cardBase, minWidth: 280, maxWidth: 320 }}
                  primaria={tk.primaria}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div
                      className="h-12 w-12 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: tk.primaria }}
                    >
                      <BookOpen className="h-5 w-5" />
                    </div>
                  </div>
                  {a.modulo && (
                    <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{a.modulo}</div>
                  )}
                  <div className="font-bold leading-snug">{a.titulo}</div>
                  {a.descricao && <div className="mt-1.5 text-xs opacity-70 line-clamp-3 min-h-[3em]">{a.descricao}</div>}
                  <div className="mt-4 flex flex-wrap gap-2">
                    <a
                      href={a.material_url ?? "#"}
                      target="_blank"
                      rel="noreferrer"
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full ${btnLift}`}
                      style={{ backgroundColor: tk.botao, color: "#fff" }}
                    >
                      <Download className="h-3 w-3" /> Baixar material
                    </a>
                    <button
                      onClick={() => navigate({ to: "/e/$slug/aula/$aulaId", params: { slug, aulaId: a.slug ?? a.id } })}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-full ${btnLift}`}
                      style={{ backgroundColor: "transparent", color: tk.text, border: `1px solid ${tk.border}` }}
                    >
                      Ver aula <ChevronRight className="h-3 w-3" />
                    </button>
                  </div>
                </EffectCard>
              ))}
            </Carousel>
          )}
        </Section>

        {/* Cursos */}
        <Section
          id="sec-cursos"
          title="Cursos"
          subtitle="Conteúdo do seu programa"
          tk={tk}
          empty={data.cursos.length === 0}
          emptyMsg="Nenhum curso liberado ainda."
        >
          <Carousel enterClass={enterClass}>
            {data.cursos.map((c) => {
              return (
                <EffectCard
                  key={c.id}
                  effects={effects}
                  baseStyle={{ ...cardBase, cursor: c.primeira_aula_id ? "pointer" : "default", minWidth: 300, maxWidth: 340, padding: 0, overflow: "hidden", opacity: c.primeira_aula_id ? 1 : 0.7 }}
                  primaria={tk.primaria}
                  onClick={() => {
                    if (c.primeira_aula_id) {
                      navigate({ to: "/e/$slug/aula/$aulaId", params: { slug, aulaId: c.primeira_aula_slug ?? c.primeira_aula_id } });
                    }
                  }}
                >
                  {b.card_exibir_imagem && (
                    <div
                      className="h-40 w-full flex items-center justify-center"
                      style={{
                        backgroundImage: c.capa_url
                          ? `linear-gradient(180deg, rgba(0,0,0,0) 50%, rgba(0,0,0,0.4)), url(${c.capa_url})`
                          : `linear-gradient(135deg, ${tk.primaria}, ${tk.secundaria})`,
                        backgroundSize: "cover",
                        backgroundPosition: "center",
                      }}
                    >
                      <GraduationCap className="h-12 w-12 text-white/90 drop-shadow" />
                    </div>
                  )}
                  <div style={{ padding }}>
                    {c.categoria && (
                      <div className="text-[10px] uppercase tracking-wider opacity-60 mb-1">{c.categoria}</div>
                    )}
                    <div className="font-bold leading-snug">{c.titulo}</div>
                    {c.descricao && <div className="mt-1.5 text-xs opacity-70 line-clamp-2">{c.descricao}</div>}
                    <div className="mt-3 flex items-center gap-3 text-[11px] opacity-70">
                      <span className="inline-flex items-center gap-1">
                        <PlayCircle className="h-3 w-3" /> {c.total_aulas} aula{c.total_aulas === 1 ? "" : "s"}
                      </span>
                      {c.nivel && <span className="capitalize">{c.nivel}</span>}
                    </div>
                  </div>
                </EffectCard>
              );
            })}
          </Carousel>
        </Section>
      </main>
    </div>
  );
}

function IconToggle({
  onClick,
  title,
  tk,
  children,
}: {
  onClick: () => void;
  title: string;
  tk: { navBg: string; navText: string; border: string };
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="h-9 w-9 rounded-full backdrop-blur-md flex items-center justify-center transition-all hover:scale-110"
      style={{ backgroundColor: tk.navBg, color: tk.navText, border: `1px solid ${tk.border}` }}
    >
      {children}
    </button>
  );
}

function Section({
  id,
  title,
  subtitle,
  tk,
  empty,
  emptyMsg,
  children,
}: {
  id: string;
  title: string;
  subtitle?: string;
  tk: { primaria: string; secundaria: string; border: string };
  empty: boolean;
  emptyMsg: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-28">
      <div className="flex items-end justify-between mb-5">
        <div>
          <div
            className="text-[10px] uppercase tracking-[0.3em] font-bold mb-1"
            style={{ color: tk.primaria }}
          >
            Seção
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">{title}</h2>
          {subtitle && <p className="mt-1 text-sm opacity-70">{subtitle}</p>}
        </div>
      </div>
      {empty ? (
        <div
          className="rounded-2xl p-10 text-center text-sm opacity-60"
          style={{ border: `1px dashed ${tk.border}` }}
        >
          {emptyMsg}
        </div>
      ) : (
        children
      )}
    </section>
  );
}

function Carousel({ enterClass, children }: { enterClass: string; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = ref.current;
    if (!el) return;
    el.scrollBy({ left: dir * (el.clientWidth * 0.8), behavior: "smooth" });
  };
  return (
    <div className="relative">
      <button
        onClick={() => scroll(-1)}
        className="hidden md:flex absolute -left-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-border items-center justify-center shadow-md hover:scale-110 transition"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <button
        onClick={() => scroll(1)}
        className="hidden md:flex absolute -right-3 top-1/2 -translate-y-1/2 z-10 h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-border items-center justify-center shadow-md hover:scale-110 transition"
        aria-label="Próximo"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div
        ref={ref}
        className={`flex gap-5 overflow-x-auto snap-x snap-mandatory pt-8 pb-12 -my-4 -mx-4 px-4 scrollbar-thin ${enterClass}`}
        style={{ scrollbarWidth: "thin" }}
      >
        {Array.isArray(children) ? (
          (children as React.ReactNode[]).map((child, i) => (
            <div key={i} className="snap-start shrink-0">
              {child}
            </div>
          ))
        ) : (
          <div className="snap-start shrink-0">{children}</div>
        )}
      </div>
    </div>
  );
}

// `useMemo` import kept for tree-shake safety (no-op).
void useMemo;
