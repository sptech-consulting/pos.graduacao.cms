import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getApiUser } from "@/lib/backend-auth";
import { getAdminProfile, signOut, type AdminProfile } from "@/lib/auth";
import { SptechLogo } from "@/components/SptechLogo";
import { Toaster } from "@/components/ui/sonner";
import {
  LayoutDashboard,
  Layers,
  Wrench,
  
  GraduationCap,
  BookOpen,
  Users,
  Shield,
  LogOut,
  MessageSquare,
  ScrollText,
  BarChart3,
  ChevronDown,
  Sparkles,
  Settings,
  Eye,
  Menu,
  X,
} from "lucide-react";

export const Route = createFileRoute("/admin")({
  beforeLoad: async () => {
    const user = await getApiUser();
    if (!user || user.role !== "admin" || user.status !== "ativo") throw redirect({ to: "/admin/entrar" });
  },
  component: AdminShell,
});

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; exact?: boolean };
type NavGroup = { id: string; label: string; icon: typeof LayoutDashboard; items: NavItem[] };

const SOLO: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/admin/metricas", label: "Métricas", icon: BarChart3 },
];

const GROUPS: NavGroup[] = [
  {
    id: "ambientes",
    label: "Ambientes e Turmas",
    icon: Layers,
    items: [
      { to: "/admin/ambientes", label: "Ambientes", icon: Layers },
      { to: "/admin/alunos", label: "Alunos", icon: Users },
      { to: "/admin/ferramentas", label: "Ferramentas", icon: Wrench },
    ],
  },
  {
    id: "ead",
    label: "EAD",
    icon: GraduationCap,
    items: [
      { to: "/admin/cursos", label: "Cursos", icon: BookOpen },
      { to: "/admin/trabalhos", label: "Trabalhos (Mural)", icon: Sparkles },
    ],
  },
  {
    id: "monitoria",
    label: "Monitoria",
    icon: Eye,
    items: [
      { to: "/admin/comentarios", label: "Comentários", icon: MessageSquare },
      { to: "/admin/logs", label: "Logs", icon: ScrollText },
    ],
  },
  {
    id: "config",
    label: "Configurações",
    icon: Settings,
    items: [
      { to: "/admin/usuarios", label: "Usuários Admin", icon: Users },
      { to: "/admin/grupos", label: "Grupos e Permissões", icon: Shield },
    ],
  },
];

function AdminShell() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<AdminProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminProfile().then((p) => {
      setProfile(p);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Carregando…</div>;

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="max-w-md text-center rounded-xl border border-border bg-card p-8">
          <h1 className="text-xl font-black text-secondary">Sem acesso administrativo</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Seu usuário não está vinculado a nenhum grupo administrativo. Peça a um Super Admin para liberar seu acesso.
          </p>
          <button
            onClick={async () => {
              await signOut();
              navigate({ to: "/admin/entrar" });
            }}
            className="mt-6 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground"
          >
            Sair
          </button>
        </div>
      </div>
    );
  }

  return <AdminShellLayout profile={profile} onSignOut={async () => { await signOut(); navigate({ to: "/" }); }} />;
}

function AdminShellLayout({
  profile,
  onSignOut,
}: {
  profile: AdminProfile;
  onSignOut: () => Promise<void>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Fecha o drawer ao mudar de rota
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Trava scroll do body quando drawer aberto
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.body.style.overflow = mobileOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const SidebarContent = (
    <>
      <div className="p-5 border-b border-border flex items-center justify-between">
        <div>
          <SptechLogo />
          <div className="mt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            Área administrativa
          </div>
        </div>
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="md:hidden p-1.5 rounded-md hover:bg-muted text-secondary"
          aria-label="Fechar menu"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <AdminNav />
      <div className="p-3 border-t border-border text-xs">
        <div className="font-semibold text-secondary">{profile.nome}</div>
        <div className="text-muted-foreground truncate">{profile.email}</div>
        <button
          onClick={onSignOut}
          className="mt-2 inline-flex items-center gap-1 text-primary hover:underline"
        >
          <LogOut className="h-3 w-3" /> Sair
        </button>
      </div>
    </>
  );

  return (
    <div className="min-h-screen flex bg-muted">
      {/* Sidebar desktop */}
      <aside className="hidden md:flex w-64 border-r border-border bg-card flex-col shrink-0 sticky top-0 h-screen self-start">
        {SidebarContent}
      </aside>

      {/* Drawer mobile */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={`md:hidden fixed inset-y-0 left-0 z-50 w-72 max-w-[85vw] bg-card border-r border-border flex flex-col transition-transform duration-300 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {SidebarContent}
      </aside>

      {/* Conteúdo */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar mobile */}
        <header className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 border-b border-border bg-card px-4 py-2.5">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="p-2 -ml-2 rounded-md hover:bg-muted text-secondary"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <SptechLogo />
          <button
            onClick={onSignOut}
            className="p-2 -mr-2 rounded-md hover:bg-muted text-secondary"
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>

        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
      <Toaster richColors position="top-right" />
    </div>
  );
}

function AdminNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const isActive = (to: string, exact?: boolean) =>
    exact ? pathname === to : pathname === to || pathname.startsWith(to + "/");

  const initiallyOpen = useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const g of GROUPS) map[g.id] = g.items.some((i) => isActive(i.to));
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  const [open, setOpen] = useState<Record<string, boolean>>(initiallyOpen);

  // Garante que o grupo da rota ativa fique aberto ao navegar
  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const g of GROUPS) if (initiallyOpen[g.id]) next[g.id] = true;
      return next;
    });
  }, [initiallyOpen]);

  return (
    <nav className="p-3 flex flex-col gap-0.5 text-sm flex-1 overflow-y-auto">
      {SOLO.map((it) => {
        const Icon = it.icon;
        const active = isActive(it.to, it.exact);
        return (
          <Link
            key={it.to}
            to={it.to}
            activeOptions={{ exact: !!it.exact }}
            className={`flex items-center gap-2 rounded-md px-3 py-2 transition-colors ${
              active ? "bg-primary text-primary-foreground" : "text-secondary hover:bg-muted"
            }`}
          >
            <Icon className="h-4 w-4" />
            {it.label}
          </Link>
        );
      })}

      <div className="my-2 border-t border-border" />

      {GROUPS.map((g) => {
        const GIcon = g.icon;
        const isOpen = open[g.id] ?? false;
        const hasActive = g.items.some((i) => isActive(i.to));
        return (
          <div key={g.id} className="mt-1">
            <button
              type="button"
              onClick={() => setOpen((p) => ({ ...p, [g.id]: !isOpen }))}
              className={`w-full flex items-center justify-between gap-2 rounded-md px-3 py-2 text-[11px] uppercase tracking-wider font-bold transition-colors ${
                hasActive ? "text-primary" : "text-muted-foreground hover:text-secondary"
              }`}
            >
              <span className="flex items-center gap-2">
                <GIcon className="h-3.5 w-3.5" />
                {g.label}
              </span>
              <ChevronDown
                className={`h-3.5 w-3.5 transition-transform ${isOpen ? "rotate-180" : ""}`}
              />
            </button>
            {isOpen && (
              <div className="mt-0.5 ml-2 pl-2 border-l border-border flex flex-col gap-0.5">
                {g.items.map((it) => {
                  const Icon = it.icon;
                  const active = isActive(it.to);
                  return (
                    <Link
                      key={it.to}
                      to={it.to}
                      className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 transition-colors ${
                        active
                          ? "bg-primary text-primary-foreground"
                          : "text-secondary hover:bg-muted"
                      }`}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {it.label}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </nav>
  );
}
