import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { SptechLogo } from "@/components/SptechLogo";
import { requestApiPasswordReset, type AuthRole } from "@/lib/backend-auth";

export const Route = createFileRoute("/esqueci-senha")({
  validateSearch: (search: Record<string, unknown>) => {
    const role = search.role === "aluno" ? "aluno" : "admin";
    return { role };
  },
  head: () => ({ meta: [{ title: "Recuperar senha — SPTech" }] }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const { role } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const roleLabel = role === "aluno" ? "aluno" : "administrador";

  async function handlePasswordReset(emailValue: string, roleValue: AuthRole) {
    await requestApiPasswordReset(emailValue, roleValue);
  }

  async function handle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await handlePasswordReset(email, role);
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao enviar e-mail");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="block mb-6"><SptechLogo /></Link>
        <div className="rounded-xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-black text-secondary">Recuperar senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Informe o e-mail do {roleLabel}. Enviaremos um link para você criar uma nova senha.
          </p>
          {sent ? (
            <div className="mt-6 rounded-md bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-800">
              Pronto! Se este e-mail estiver cadastrado, você receberá um link em instantes.
            </div>
          ) : (
            <form onSubmit={handle} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-secondary">E-mail</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Enviando..." : "Enviar link"}
              </button>
            </form>
          )}
          <div className="mt-4 text-center text-xs text-muted-foreground">
            <Link to="/admin/entrar" className="hover:text-secondary">← voltar ao login</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
