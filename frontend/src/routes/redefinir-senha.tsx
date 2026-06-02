import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { SptechLogo } from "@/components/SptechLogo";
import { resetApiPassword } from "@/lib/backend-auth";
import { validarSenhaForte, forcaSenha } from "@/lib/password";

export const Route = createFileRoute("/redefinir-senha")({
  validateSearch: (search: Record<string, unknown>) => {
    const token = typeof search.token === "string" ? search.token : "";
    return { token };
  },
  head: () => ({ meta: [{ title: "Nova senha — SPTech" }] }),
  component: ResetPassword,
});

function ResetPassword() {
  const { token } = Route.useSearch();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const ready = useMemo(() => token.length === 64, [token]);

  async function handle(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const erroPolitica = validarSenhaForte(password);
    if (erroPolitica) {
      setError(erroPolitica);
      return;
    }
    if (password !== confirm) {
      setError("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      await resetApiPassword(token, password);
      setSuccess(true);
      setTimeout(() => navigate({ to: "/admin/entrar" }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao atualizar senha");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-muted px-4">
      <div className="w-full max-w-md">
        <SptechLogo />
        <div className="mt-6 rounded-xl border border-border bg-card p-8 shadow-sm">
          <h1 className="text-2xl font-black text-secondary">Defina sua nova senha</h1>
          {!ready ? (
            <p className="mt-4 text-sm text-muted-foreground">
              Abra esta página pelo link de recuperação enviado no seu e-mail. Sem o link, a senha não pode ser alterada.
            </p>
          ) : success ? (
            <p className="mt-4 rounded-md bg-emerald-50 border border-emerald-200 px-3 py-2 text-sm text-emerald-800">
              Senha atualizada com sucesso. Redirecionando…
            </p>
          ) : (
            <form onSubmit={handle} className="mt-6 space-y-4">
              <div>
                <label className="text-xs font-semibold text-secondary">Nova senha</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
                <div className="mt-2 flex gap-1" aria-hidden>
                  {[0, 1, 2, 3].map((i) => (
                    <span
                      key={i}
                      className={`h-1 flex-1 rounded-full ${
                        forcaSenha(password) > i
                          ? forcaSenha(password) >= 3
                            ? "bg-emerald-500"
                            : forcaSenha(password) === 2
                              ? "bg-amber-500"
                              : "bg-orange-500"
                          : "bg-muted"
                      }`}
                    />
                  ))}
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  Use 8+ caracteres, com maiúscula, número ou símbolo. Evitamos senhas conhecidas em vazamentos.
                </p>
              </div>
              <div>
                <label className="text-xs font-semibold text-secondary">Confirme a senha</label>
                <input
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={8}
                  className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              {error && <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div>}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
              >
                {loading ? "Salvando..." : "Salvar nova senha"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
