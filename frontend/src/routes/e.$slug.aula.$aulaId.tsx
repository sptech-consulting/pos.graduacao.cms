import { createFileRoute, redirect, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getApiUser } from "@/lib/backend-auth";
import {
  getAulaPlayer,
  marcarAulaConcluida,
  postarComentario,
  removerComentario,
  toggleCurtidaComentario,
  salvarProgressoVideo,
  type AulaPlayerData,
  type AulaPlayerComentario,
} from "@/lib/aula-player.functions";
import {
  ChevronRight,
  ChevronDown,
  ChevronLeft,
  CheckCircle2,
  Circle,
  Maximize2,
  Minimize2,
  ThumbsUp,
  Reply,
  Trash2,
  Home,
  PlayCircle,
  FileText,
  Loader2,
  SkipForward,
  Menu,
  X,
} from "lucide-react";

export const Route = createFileRoute("/e/$slug/aula/$aulaId")({
  beforeLoad: async ({ params }) => {
    const user = await getApiUser();
    if (!user || user.role !== "aluno" || user.status !== "ativo") {
      throw redirect({ to: "/e/$slug/entrar", params: { slug: params.slug } });
    }
  },
  component: AulaPlayerPage,
});

type VideoSize = "default" | "theater";

function AulaPlayerPage() {
  const { slug, aulaId } = Route.useParams();
  const navigate = useNavigate();
  const fetchPlayer = useServerFn(getAulaPlayer);
  const fnConcluir = useServerFn(marcarAulaConcluida);
  const fnComentar = useServerFn(postarComentario);
  const fnRemover = useServerFn(removerComentario);
  const fnCurtir = useServerFn(toggleCurtidaComentario);
  const fnProgresso = useServerFn(salvarProgressoVideo);

  const [data, setData] = useState<AulaPlayerData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [videoSize, setVideoSize] = useState<VideoSize>("default");
  const [openModulos, setOpenModulos] = useState<Record<string, boolean>>({});
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [novoComentario, setNovoComentario] = useState("");
  const [replyText, setReplyText] = useState("");
  const [posting, setPosting] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  // Fecha o drawer mobile ao trocar de aula
  useEffect(() => {
    setMobileNav(false);
  }, [aulaId]);

  const reload = async () => {
    try {
      const res = await fetchPlayer({ data: { slug, aulaId } });
      setData(res);
      setOpenModulos((prev) => ({ ...prev, [res.modulo_atual.id]: true }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao carregar aula");
    }
  };

  useEffect(() => {
    void reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, aulaId]);

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
        <div className="max-w-md text-center border border-border rounded-xl p-8">
          <h1 className="text-xl font-black">Não foi possível abrir a aula</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <Link to="/e/$slug" params={{ slug }} className="mt-4 inline-block text-sm underline">
            Voltar ao ambiente
          </Link>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const b = data.branding;
  const dark = b.tema === "escuro";
  const bg = dark ? "#0B0F1A" : b.cor_fundo;
  const text = dark ? "#F4F5F7" : b.cor_texto;
  const card = dark ? "#141925" : b.cor_card;
  const border = dark ? "#1F2A44" : b.cor_borda;
  const muted = dark ? "#9aa3b2" : "#6b7280";

  const tree = buildTree(data.comentarios);

  const toggleConcluida = async () => {
    await fnConcluir({ data: { slug, aulaId, concluida: !data.aula.concluida } });
    void reload();
  };

  const submitTop = async () => {
    if (!novoComentario.trim() || posting) return;
    setPosting(true);
    try {
      await fnComentar({ data: { slug, aulaId, conteudo: novoComentario } });
      setNovoComentario("");
      await reload();
    } finally {
      setPosting(false);
    }
  };

  const submitReply = async (parentId: string) => {
    if (!replyText.trim() || posting) return;
    setPosting(true);
    try {
      await fnComentar({ data: { slug, aulaId, conteudo: replyText, parentId } });
      setReplyText("");
      setReplyTo(null);
      await reload();
    } finally {
      setPosting(false);
    }
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: bg, color: text }}>
      {/* Top bar */}
      <header
        className="sticky top-0 z-30 backdrop-blur-xl border-b"
        style={{ backgroundColor: bg + "ee", borderColor: border }}
      >
        <div className="max-w-[1400px] mx-auto px-4 sm:px-6 py-3 flex items-center gap-3">
          <Link
            to="/e/$slug"
            params={{ slug }}
            className="inline-flex items-center gap-1.5 text-xs font-semibold opacity-80 hover:opacity-100"
          >
            <Home className="h-3.5 w-3.5" /> {b.nome}
          </Link>
          <Breadcrumb sep={muted}>
            <span className="opacity-70 hidden sm:inline">{data.curso.titulo}</span>
            <span className="opacity-70 hidden md:inline">{data.modulo_atual.titulo}</span>
            <span className="font-semibold truncate" style={{ color: b.cor_primaria }}>
              {data.aula.titulo}
            </span>
          </Breadcrumb>
          <button
            onClick={() => setMobileNav(true)}
            className="ml-auto inline-flex lg:hidden items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold border"
            style={{ borderColor: border, color: text }}
            aria-label="Abrir lista de aulas"
          >
            <Menu className="h-3.5 w-3.5" /> Aulas
          </button>
        </div>
      </header>

      <div
        className={`mx-auto px-4 sm:px-6 py-6 grid gap-6 ${
          videoSize === "theater" ? "max-w-[1600px]" : "max-w-[1400px]"
        } ${videoSize === "theater" ? "grid-cols-1" : "lg:grid-cols-[1fr_360px]"}`}
      >
        {/* Coluna principal: player + descrição */}
        <main className="min-w-0">
          <div
            className="relative rounded-2xl overflow-hidden border"
            style={{
              borderColor: border,
              backgroundColor: "#000",
              aspectRatio: videoSize === "theater" ? "21/9" : "16/9",
            }}
          >
            <VideoPlayer
              url={data.aula.video_url}
              startAt={data.aula.segundos_assistidos}
              onProgress={(s) => {
                void fnProgresso({ data: { slug, aulaId, segundos: s } }).catch(() => {});
              }}
              onEnded={() => {
                void fnProgresso({ data: { slug, aulaId, segundos: 0, concluida: true } });
                if (data.proxima_aula_id) {
                  navigate({ to: "/e/$slug/aula/$aulaId", params: { slug, aulaId: data.proxima_aula_id } });
                } else {
                  void reload();
                }
              }}
            />
            <button
              onClick={() => setVideoSize((s) => (s === "default" ? "theater" : "default"))}
              className="absolute bottom-3 right-3 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold bg-black/60 text-white hover:bg-black/80 transition"
              title={videoSize === "default" ? "Modo cinema" : "Tamanho padrão"}
            >
              {videoSize === "default" ? (
                <>
                  <Maximize2 className="h-3.5 w-3.5" /> Cinema
                </>
              ) : (
                <>
                  <Minimize2 className="h-3.5 w-3.5" /> Padrão
                </>
              )}
            </button>
          </div>

          <div className="mt-5 flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="text-[11px] uppercase tracking-wider" style={{ color: muted }}>
                {data.modulo_atual.titulo}
              </div>
              <h1 className="text-2xl font-black leading-tight">{data.aula.titulo}</h1>
              {data.aula.duracao_minutos && (
                <div className="mt-1 text-xs" style={{ color: muted }}>
                  {data.aula.duracao_minutos} min
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {data.aula.material_url && (
                <a
                  href={data.aula.material_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border"
                  style={{ borderColor: border, color: text }}
                >
                  <FileText className="h-3.5 w-3.5" /> Material
                </a>
              )}
              <button
                onClick={toggleConcluida}
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: data.aula.concluida ? "#16a34a" : b.cor_botao }}
              >
                {data.aula.concluida ? (
                  <>
                    <CheckCircle2 className="h-3.5 w-3.5" /> Concluída
                  </>
                ) : (
                  <>
                    <Circle className="h-3.5 w-3.5" /> Marcar como concluída
                  </>
                )}
              </button>
              {data.proxima_aula_id && (
                <button
                  onClick={() =>
                    navigate({
                      to: "/e/$slug/aula/$aulaId",
                      params: { slug, aulaId: data.proxima_aula_id! },
                    })
                  }
                  className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border"
                  style={{ borderColor: border, color: text }}
                  title={data.proxima_aula_titulo ?? ""}
                >
                  Próxima aula <SkipForward className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {data.aula.descricao && (
            <div
              className="mt-4 rounded-xl p-4 text-sm leading-relaxed whitespace-pre-wrap"
              style={{ backgroundColor: card, border: `1px solid ${border}` }}
            >
              {data.aula.descricao}
            </div>
          )}

          {/* Comentários */}
          <section className="mt-10">
            <h2 className="text-xl font-black mb-4">Comentários ({data.comentarios.length})</h2>
            <div
              className="rounded-xl p-4 mb-6"
              style={{ backgroundColor: card, border: `1px solid ${border}` }}
            >
              <textarea
                value={novoComentario}
                onChange={(e) => setNovoComentario(e.target.value)}
                placeholder={`Escreva um comentário como ${data.aluno.nome_completo}...`}
                rows={3}
                className="w-full bg-transparent outline-none text-sm resize-none"
                style={{ color: text }}
                maxLength={4000}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px]" style={{ color: muted }}>
                  {novoComentario.length}/4000
                </span>
                <button
                  onClick={submitTop}
                  disabled={!novoComentario.trim() || posting}
                  className="px-4 py-1.5 rounded-lg text-xs font-bold text-white disabled:opacity-50"
                  style={{ backgroundColor: b.cor_botao }}
                >
                  {posting ? "Publicando..." : "Comentar"}
                </button>
              </div>
            </div>

            <div className="space-y-5">
              {tree.length === 0 && (
                <div
                  className="text-center text-sm rounded-xl p-8"
                  style={{ color: muted, border: `1px dashed ${border}` }}
                >
                  Seja o primeiro a comentar nesta aula.
                </div>
              )}
              {tree.map((c) => (
                <ComentarioNode
                  key={c.id}
                  node={c}
                  depth={0}
                  branding={b}
                  cardBg={card}
                  borderC={border}
                  muted={muted}
                  text={text}
                  replyTo={replyTo}
                  setReplyTo={(id) => {
                    setReplyTo(id);
                    setReplyText("");
                  }}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onSubmitReply={submitReply}
                  onCurtir={async (id) => {
                    await fnCurtir({ data: { slug, aulaId, comentarioId: id } });
                    void reload();
                  }}
                  onRemover={async (id) => {
                    await fnRemover({ data: { slug, aulaId, comentarioId: id } });
                    void reload();
                  }}
                  posting={posting}
                />
              ))}
            </div>
          </section>
        </main>

        {/* Sidebar direita (desktop) + Drawer (mobile) */}
        {videoSize === "default" && (
          <>
            {mobileNav && (
              <div
                className="fixed inset-0 z-40 bg-black/60 lg:hidden"
                onClick={() => setMobileNav(false)}
                aria-hidden
              />
            )}
            <aside
              className={
                mobileNav
                  ? "fixed right-0 top-0 bottom-0 z-50 w-[85vw] max-w-sm overflow-y-auto p-4 space-y-5 lg:static lg:w-auto lg:max-w-none lg:p-0 lg:overflow-visible"
                  : "hidden lg:block space-y-5"
              }
              style={mobileNav ? { backgroundColor: bg } : undefined}
            >
              {mobileNav && (
                <div className="flex items-center justify-between lg:hidden">
                  <span className="text-sm font-bold">Aulas do curso</span>
                  <button
                    onClick={() => setMobileNav(false)}
                    className="p-1.5 rounded-md border"
                    style={{ borderColor: border }}
                    aria-label="Fechar"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
            <div
              className="rounded-2xl overflow-hidden"
              style={{ backgroundColor: card, border: `1px solid ${border}` }}
            >
              <div
                className="px-4 py-3 border-b text-sm font-bold"
                style={{ borderColor: border }}
              >
                {data.curso.titulo}
              </div>
              <div className="max-h-[60vh] overflow-y-auto">
                {data.modulos.map((m) => {
                  const isOpen = openModulos[m.id] ?? false;
                  return (
                    <div key={m.id} className="border-b" style={{ borderColor: border }}>
                      <button
                        onClick={() =>
                          setOpenModulos((prev) => ({ ...prev, [m.id]: !isOpen }))
                        }
                        className="w-full flex items-center justify-between px-4 py-3 text-left text-sm font-semibold hover:opacity-80"
                      >
                        <span className="flex items-center gap-2">
                          {isOpen ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                          {m.titulo}
                        </span>
                        <span className="text-[10px]" style={{ color: muted }}>
                          {m.aulas.filter((a) => a.concluida).length}/{m.aulas.length}
                        </span>
                      </button>
                      {isOpen && (
                        <ul className="pb-2">
                          {m.aulas.map((a) => {
                            const ativa = a.id === data.aula.id;
                            return (
                              <li key={a.id}>
                                <button
                                  onClick={() =>
                                    navigate({
                                      to: "/e/$slug/aula/$aulaId",
                                      params: { slug, aulaId: a.id },
                                    })
                                  }
                                  className="w-full flex items-start gap-2 px-4 py-2 text-left text-xs hover:bg-black/5 dark:hover:bg-white/5"
                                  style={{
                                    backgroundColor: ativa ? b.cor_primaria + "1a" : "transparent",
                                  }}
                                >
                                  {a.concluida ? (
                                    <CheckCircle2
                                      className="h-4 w-4 shrink-0 mt-0.5"
                                      style={{ color: "#16a34a" }}
                                    />
                                  ) : (
                                    <Circle
                                      className="h-4 w-4 shrink-0 mt-0.5"
                                      style={{ color: muted }}
                                    />
                                  )}
                                  <span className="min-w-0">
                                    <span
                                      className="block leading-snug"
                                      style={{
                                        fontWeight: ativa ? 700 : 500,
                                        color: ativa ? b.cor_primaria : text,
                                      }}
                                    >
                                      {a.titulo}
                                    </span>
                                    {a.duracao_minutos && (
                                      <span className="text-[10px]" style={{ color: muted }}>
                                        {a.duracao_minutos} min
                                      </span>
                                    )}
                                  </span>
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Recomendados */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold">Outros cursos recomendados</h3>
              </div>
              <RecomendadosCarousel
                items={data.recomendados}
                onOpen={(aulaId) =>
                  navigate({ to: "/e/$slug/aula/$aulaId", params: { slug, aulaId } })
                }
                branding={b}
                card={card}
                border={border}
                muted={muted}
              />
            </div>
          </aside>
          </>
        )}
      </div>
    </div>
  );
}

function VideoPlayer({
  url,
  startAt,
  onProgress,
  onEnded,
}: {
  url: string | null;
  startAt: number;
  onProgress: (segundos: number) => void;
  onEnded: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSaved = useRef(0);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !startAt) return;
    const onMeta = () => {
      try { v.currentTime = Math.max(0, Math.min(startAt, (v.duration || startAt) - 1)); } catch {}
    };
    v.addEventListener("loadedmetadata", onMeta, { once: true });
    return () => v.removeEventListener("loadedmetadata", onMeta);
  }, [startAt, url]);

  if (!url) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-white/70 text-sm">
        Vídeo não disponível
      </div>
    );
  }
  const embed = toEmbedUrl(url, startAt);
  if (embed) {
    return (
      <iframe
        src={embed}
        className="absolute inset-0 w-full h-full"
        title="Player"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowFullScreen
      />
    );
  }
  return (
    <video
      ref={videoRef}
      src={url}
      controls
      className="absolute inset-0 w-full h-full bg-black"
      preload="metadata"
      onTimeUpdate={(e) => {
        const t = e.currentTarget.currentTime;
        if (t - lastSaved.current >= 10) {
          lastSaved.current = t;
          onProgress(t);
        }
      }}
      onEnded={onEnded}
    />
  );
}

function parseStartSeconds(v: string | null): number {
  if (!v) return 0;
  // Accepts "90", "90s", "1m30s", "1h2m3s"
  if (/^\d+$/.test(v)) return parseInt(v, 10);
  const m = v.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/);
  if (!m) return 0;
  const [, h, mi, s] = m;
  return (parseInt(h || "0", 10) * 3600) + (parseInt(mi || "0", 10) * 60) + parseInt(s || "0", 10);
}

function toEmbedUrl(url: string, startAt = 0): string | null {
  try {
    const u = new URL(url.trim());
    const host = u.hostname.replace(/^www\./, "");

    // YouTube: youtu.be/ID, youtube.com/watch?v=ID, /embed/ID, /shorts/ID, /live/ID
    if (host === "youtu.be" || host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      let id = "";
      if (host === "youtu.be") {
        id = u.pathname.slice(1).split("/")[0];
      } else {
        const parts = u.pathname.split("/").filter(Boolean);
        if (parts[0] === "watch") id = u.searchParams.get("v") ?? "";
        else if (["embed", "shorts", "live", "v"].includes(parts[0])) id = parts[1] ?? "";
        else id = u.searchParams.get("v") ?? "";
      }
      if (!id) return null;
      const start = parseStartSeconds(u.searchParams.get("t") ?? u.searchParams.get("start")) || Math.floor(startAt);
      const params = new URLSearchParams({ rel: "0", modestbranding: "1" });
      if (start > 0) params.set("start", String(start));
      return `https://www.youtube.com/embed/${id}?${params.toString()}`;
    }

    // Vimeo: vimeo.com/ID, vimeo.com/ID/HASH (privado), player.vimeo.com/video/ID
    if (host.endsWith("vimeo.com")) {
      const parts = u.pathname.split("/").filter(Boolean);
      let id = "";
      let hash: string | null = null;
      if (parts[0] === "video") {
        id = parts[1] ?? "";
        hash = parts[2] ?? null;
      } else {
        id = parts[0] ?? "";
        hash = parts[1] ?? null;
      }
      if (!/^\d+$/.test(id)) return null;
      const params = new URLSearchParams();
      if (hash) params.set("h", hash);
      const start = Math.floor(startAt);
      let suffix = params.toString() ? `?${params.toString()}` : "";
      if (start > 0) suffix += `${suffix ? "&" : "#"}t=${start}s`;
      return `https://player.vimeo.com/video/${id}${suffix}`;
    }

    return null;
  } catch {
    return null;
  }
}

function Breadcrumb({ children, sep }: { children: React.ReactNode; sep: string }) {
  const arr = Array.isArray(children) ? children : [children];
  return (
    <nav className="flex items-center gap-1.5 text-xs min-w-0 overflow-hidden">
      {arr.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5 truncate">
          {i > 0 && <ChevronRight className="h-3 w-3 shrink-0" style={{ color: sep }} />}
          <span className="truncate">{c}</span>
        </span>
      ))}
    </nav>
  );
}

type TreeNode = AulaPlayerComentario & { children: TreeNode[] };
function buildTree(list: AulaPlayerComentario[]): TreeNode[] {
  const map = new Map<string, TreeNode>();
  const roots: TreeNode[] = [];
  list.forEach((c) => map.set(c.id, { ...c, children: [] }));
  map.forEach((node) => {
    if (node.parent_id && map.has(node.parent_id)) {
      map.get(node.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  });
  return roots;
}

function ComentarioNode({
  node,
  depth,
  branding,
  cardBg,
  borderC,
  muted,
  text,
  replyTo,
  setReplyTo,
  replyText,
  setReplyText,
  onSubmitReply,
  onCurtir,
  onRemover,
  posting,
}: {
  node: TreeNode;
  depth: number;
  branding: AulaPlayerData["branding"];
  cardBg: string;
  borderC: string;
  muted: string;
  text: string;
  replyTo: string | null;
  setReplyTo: (id: string | null) => void;
  replyText: string;
  setReplyText: (v: string) => void;
  onSubmitReply: (parentId: string) => void;
  onCurtir: (id: string) => void;
  onRemover: (id: string) => void;
  posting: boolean;
}) {
  const initial = (node.autor_nome || "?").trim().charAt(0).toUpperCase();
  return (
    <div style={{ marginLeft: depth === 0 ? 0 : Math.min(depth, 3) * 28 }}>
      <div className="flex gap-3">
        <div
          className="h-9 w-9 rounded-full flex items-center justify-center font-bold text-white shrink-0"
          style={{
            backgroundColor:
              node.autor_tipo === "admin" ? branding.cor_secundaria : branding.cor_primaria,
          }}
        >
          {initial}
        </div>
        <div className="flex-1 min-w-0">
          <div
            className="rounded-2xl px-3.5 py-2.5"
            style={{ backgroundColor: cardBg, border: `1px solid ${borderC}` }}
          >
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-xs font-bold">{node.autor_nome}</span>
              {node.autor_tipo === "admin" && (
                <span
                  className="text-[9px] uppercase tracking-wider font-bold px-1.5 py-0.5 rounded"
                  style={{ backgroundColor: branding.cor_secundaria, color: "#fff" }}
                >
                  Equipe
                </span>
              )}
            </div>
            <div className="text-sm whitespace-pre-wrap" style={{ color: text }}>
              {node.conteudo}
            </div>
          </div>
          <div className="mt-1.5 ml-1 flex items-center gap-3 text-[11px]" style={{ color: muted }}>
            <button
              onClick={() => onCurtir(node.id)}
              className="inline-flex items-center gap-1 hover:underline"
              style={{ color: node.liked_by_me ? branding.cor_primaria : muted, fontWeight: node.liked_by_me ? 700 : 500 }}
            >
              <ThumbsUp className="h-3 w-3" />
              Curtir {node.curtidas > 0 && <span>· {node.curtidas}</span>}
            </button>
            <button
              onClick={() => setReplyTo(replyTo === node.id ? null : node.id)}
              className="inline-flex items-center gap-1 hover:underline"
            >
              <Reply className="h-3 w-3" /> Responder
            </button>
            {node.is_mine && (
              <button
                onClick={() => onRemover(node.id)}
                className="inline-flex items-center gap-1 hover:underline"
              >
                <Trash2 className="h-3 w-3" /> Remover
              </button>
            )}
            <span>{formatRelative(node.criado_em)}</span>
          </div>

          {replyTo === node.id && (
            <div
              className="mt-2 rounded-xl p-2.5"
              style={{ backgroundColor: cardBg, border: `1px solid ${borderC}` }}
            >
              <textarea
                value={replyText}
                onChange={(e) => setReplyText(e.target.value)}
                rows={2}
                placeholder="Sua resposta..."
                className="w-full bg-transparent outline-none text-sm resize-none"
                style={{ color: text }}
                maxLength={4000}
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => setReplyTo(null)}
                  className="text-xs px-3 py-1 rounded-md"
                  style={{ color: muted }}
                >
                  Cancelar
                </button>
                <button
                  onClick={() => onSubmitReply(node.id)}
                  disabled={!replyText.trim() || posting}
                  className="text-xs px-3 py-1 rounded-md text-white font-bold disabled:opacity-50"
                  style={{ backgroundColor: branding.cor_botao }}
                >
                  Responder
                </button>
              </div>
            </div>
          )}

          {node.children.length > 0 && (
            <div className="mt-3 space-y-3">
              {node.children.map((child) => (
                <ComentarioNode
                  key={child.id}
                  node={child}
                  depth={depth + 1}
                  branding={branding}
                  cardBg={cardBg}
                  borderC={borderC}
                  muted={muted}
                  text={text}
                  replyTo={replyTo}
                  setReplyTo={setReplyTo}
                  replyText={replyText}
                  setReplyText={setReplyText}
                  onSubmitReply={onSubmitReply}
                  onCurtir={onCurtir}
                  onRemover={onRemover}
                  posting={posting}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RecomendadosCarousel({
  items,
  onOpen,
  branding,
  card,
  border,
  muted,
}: {
  items: AulaPlayerData["recomendados"];
  onOpen: (aulaId: string) => void;
  branding: AulaPlayerData["branding"];
  card: string;
  border: string;
  muted: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  if (items.length === 0) {
    return (
      <div
        className="text-xs rounded-xl p-5 text-center"
        style={{ color: muted, border: `1px dashed ${border}` }}
      >
        Sem outros cursos disponíveis.
      </div>
    );
  }
  const scroll = (dir: 1 | -1) => {
    ref.current?.scrollBy({ left: dir * 260, behavior: "smooth" });
  };
  return (
    <div className="relative">
      <button
        onClick={() => scroll(-1)}
        className="absolute -left-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:scale-110 transition"
        aria-label="Anterior"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <button
        onClick={() => scroll(1)}
        className="absolute -right-2 top-1/2 -translate-y-1/2 z-10 h-7 w-7 rounded-full bg-background/80 backdrop-blur border border-border flex items-center justify-center hover:scale-110 transition"
        aria-label="Próximo"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <div
        ref={ref}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1"
        style={{ scrollbarWidth: "thin" }}
      >
        {items.map((c) => (
          <button
            key={c.curso_id}
            onClick={() => c.primeira_aula_id && onOpen(c.primeira_aula_id)}
            className="snap-start shrink-0 w-[220px] rounded-xl overflow-hidden text-left hover:scale-[1.02] transition"
            style={{ backgroundColor: card, border: `1px solid ${border}` }}
            disabled={!c.primeira_aula_id}
          >
            <div
              className="h-28 w-full flex items-center justify-center"
              style={{
                backgroundImage: c.capa_url
                  ? `linear-gradient(180deg, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55)), url(${c.capa_url})`
                  : `linear-gradient(135deg, ${branding.cor_primaria}, ${branding.cor_secundaria})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }}
            >
              <PlayCircle className="h-9 w-9 text-white/95" />
            </div>
            <div className="p-3">
              <div className="text-xs font-bold leading-snug line-clamp-2">{c.titulo}</div>
              <div className="mt-1 text-[10px]" style={{ color: muted }}>
                {c.total_aulas} aula{c.total_aulas === 1 ? "" : "s"}
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function formatRelative(iso: string) {
  const d = new Date(iso).getTime();
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "agora";
  if (diff < 3600) return `${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)} d`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

void useMemo;
