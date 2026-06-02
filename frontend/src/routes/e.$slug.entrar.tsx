import { createFileRoute, redirect } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getApiUser, signInWithApi, signOutWithApi } from "@/lib/backend-auth";
import { getAmbienteBranding } from "@/lib/ambiente.functions";
import { ensureAlunoAuthLink, checkAlunoAmbienteAccess } from "@/lib/aluno.functions";

type Branding = Awaited<ReturnType<typeof getAmbienteBranding>>;

export const Route = createFileRoute("/e/$slug/entrar")({
  beforeLoad: async ({ params }) => {
    const user = await getApiUser();
    if (user?.role === "aluno" && user.status === "ativo") {
      throw redirect({ to: "/e/$slug", params: { slug: params.slug } });
    }
  },
  component: AmbienteLogin,
});

function AmbienteLogin() {
  const { slug } = Route.useParams();
  const fetchBranding = useServerFn(getAmbienteBranding);
  const linkAluno = useServerFn(ensureAlunoAuthLink);
  const checkAccess = useServerFn(checkAlunoAmbienteAccess);
  const [b, setB] = useState<Branding | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void fetchBranding({ data: { slug } }).then(setB).catch(() => setB(null));
  }, [slug, fetchBranding]);

  async function handle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    try {
      await signInWithApi(email, password, "aluno");

      // Vincula auth.uid -> alunos.auth_user_id pelo email
      const aluno = await linkAluno();
      if (!aluno) {
        await signOutWithApi();
        throw new Error("Seu e-mail não está cadastrado como aluno. Procure o administrador.");
      }

      // Confere acesso ao ambiente
      const res = await checkAccess({ data: { slug } });
      if (!res.ok) {
        await signOutWithApi();
        const msg =
          res.reason === "no_aluno"
            ? "Seu e-mail não está cadastrado como aluno. Procure o administrador."
            : res.reason === "no_link"
              ? "Você não tem acesso a este ambiente."
              : res.reason === "inativo"
                ? "Este ambiente está inativo."
                : "Ambiente não encontrado.";
        throw new Error(msg);
      }
      window.location.assign(`/e/${slug}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Erro ao autenticar";
      if (message.toLowerCase().includes("credenciais inválidas")) {
        setError("Ainda não existe uma senha válida para este e-mail ou a senha está incorreta.");
        setInfo("Se for seu primeiro acesso, solicite ao administrador o reset de senha.");
      } else {
        setError(message);
      }
      setLoading(false);
    }
  }

  if (b === null && !loading) {
    // could be loading or not found; render minimal shell
  }
  if (b && (b as any)._inativo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted px-6">
        <div className="max-w-md text-center">
          <h1 className="text-xl font-black">Ambiente indisponível</h1>
          <p className="mt-2 text-sm text-muted-foreground">Este ambiente está inativo.</p>
        </div>
      </div>
    );
  }

  const corPrim = b?.cor_primaria ?? "#ED145B";
  const corFundo = b?.cor_fundo ?? "#FFFFFF";
  const corTexto = b?.cor_texto ?? "#1F2A44";
  const corCard = b?.cor_card ?? "#FFFFFF";
  const corBorda = b?.cor_borda ?? "#D0D3D4";
  const corBotao = b?.cor_botao ?? corPrim;

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ backgroundColor: corFundo, color: corTexto }}
    >
      <div className="w-full max-w-md">
        <div className="mb-6 flex justify-center">
          {b?.logo_url ? (
            <img src={b.logo_url} alt={b.nome} className="h-12 object-contain" />
          ) : (
            <div className="text-2xl font-black" style={{ color: corPrim }}>
              {b?.nome ?? slug}
            </div>
          )}
        </div>
        <div
          className="rounded-xl p-8 shadow-sm"
          style={{ backgroundColor: corCard, border: `1px solid ${corBorda}` }}
        >
          <h1 className="text-2xl font-black">{b?.nome ?? "Acesso"}</h1>
          <p className="mt-1 text-sm opacity-70">Use seu e-mail e senha.</p>
          <form onSubmit={handle} className="mt-6 space-y-4">
            <div>
              <label className="text-xs font-semibold">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="mt-1 w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{ border: `1px solid ${corBorda}`, backgroundColor: corFundo, color: corTexto }}
              />
            </div>
            <div>
              <label className="text-xs font-semibold">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                className="mt-1 w-full rounded-md px-3 py-2 text-sm outline-none"
                style={{ border: `1px solid ${corBorda}`, backgroundColor: corFundo, color: corTexto }}
              />
            </div>
            {error && (
              <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 border border-red-200">
                {error}
              </div>
            )}
            {info && (
              <div className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-800 border border-amber-200">
                {info}
              </div>
            )}
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-md px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
              style={{ backgroundColor: corBotao }}
            >
              {loading ? "Aguarde..." : "Entrar"}
            </button>
          </form>
          <div className="mt-4 flex items-center justify-end gap-3 text-xs opacity-80">
            <a href="/esqueci-senha?role=aluno" className="hover:opacity-100" style={{ color: corPrim }}>
              Esqueci minha senha
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
