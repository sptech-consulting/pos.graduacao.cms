import { createFileRoute, Outlet, redirect, useNavigate } from "@tanstack/react-router";
import { getApiUser } from "@/lib/backend-auth";
import { signOut } from "@/lib/auth";

export const Route = createFileRoute("/aluno")({
  beforeLoad: async () => {
    const user = await getApiUser();
    if (!user || user.role !== "aluno" || user.status !== "ativo") throw redirect({ to: "/aluno/entrar" });
  },
  component: AlunoShell,
});

function AlunoShell() {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-5xl flex items-center justify-between px-6 py-4">
          <div className="font-black text-secondary">Área do Aluno</div>
          <button onClick={async () => { await signOut(); navigate({ to: "/" }); }}
            className="text-sm text-primary hover:underline">Sair</button>
        </div>
      </header>
      <Outlet />
    </div>
  );
}
