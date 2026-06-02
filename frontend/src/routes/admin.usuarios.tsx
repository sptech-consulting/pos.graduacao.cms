import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, KeyRound, ShieldCheck, ShieldOff, Pencil } from "lucide-react";
import { toast } from "sonner";
import {
  inviteAdminUser,
  updateAdminUserGroups,
  setAdminUserStatus,
  sendAdminPasswordReset,
} from "@/lib/admin-users.functions";

type Admin = {
  id: string;
  nome: string;
  email: string;
  status: "ativo" | "inativo";
  criado_em: string;
  ultimo_acesso_em: string | null;
  usuarios_admin_grupos: {
    id: string;
    grupo_id: string;
    acesso_global: boolean | null;
    ambiente_id: string | null;
    grupos_acesso: { nome: string } | null;
    ambientes?: { nome: string } | null;
  }[];
};

type Grupo = { id: string; nome: string; escopo: "global" | "ambiente" };
type Ambiente = { id: string; nome: string };

export const Route = createFileRoute("/admin/usuarios")({
  component: UsuariosPage,
});

function UsuariosPage() {
  const invite = useServerFn(inviteAdminUser);
  const updateGroups = useServerFn(updateAdminUserGroups);
  const setStatus = useServerFn(setAdminUserStatus);
  const sendReset = useServerFn(sendAdminPasswordReset);

  const [admins, setAdmins] = useState<Admin[]>([]);
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [ambientes, setAmbientes] = useState<Ambiente[]>([]);
  const [loading, setLoading] = useState(true);
  const [openNew, setOpenNew] = useState(false);
  const [editing, setEditing] = useState<Admin | null>(null);

  async function load() {
    setLoading(true);
    const [{ data: a }, { data: g }, { data: amb }] = await Promise.all([
      supabase
        .from("usuarios_admin")
        .select(
          "id,nome,email,status,criado_em,ultimo_acesso_em,usuarios_admin_grupos(id,grupo_id,acesso_global,ambiente_id,grupos_acesso(nome))",
        )
        .order("criado_em", { ascending: false }),
      supabase.from("grupos_acesso").select("id,nome,escopo").order("nome"),
      supabase.from("ambientes").select("id,nome").order("nome"),
    ]);
    setAdmins((a as any) ?? []);
    setGrupos((g as any) ?? []);
    setAmbientes((amb as any) ?? []);
    setLoading(false);
  }

  useEffect(() => {
    void load();
  }, []);

  async function handleToggleStatus(a: Admin) {
    const next = a.status === "ativo" ? "inativo" : "ativo";
    try {
      await setStatus({ data: { usuario_admin_id: a.id, status: next } });
      toast.success(`Usuário ${next === "ativo" ? "ativado" : "desativado"}.`);
      void load();
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  async function handleReset(a: Admin) {
    try {
      await sendReset({ data: { usuario_admin_id: a.id } });
      toast.success("E-mail de redefinicao enviado.");
    } catch (e: any) {
      toast.error(e.message);
    }
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-6xl">
      <PageHeader
        title="Usuários administradores"
        description="Convide pessoas para acessar o painel e atribua grupos de permissão."
        actions={
          <Button onClick={() => setOpenNew(true)}>
            <Plus className="h-4 w-4" /> Novo administrador
          </Button>
        }
      />

      <div className="rounded-xl border border-border bg-card overflow-hidden">
        {loading ? (
          <div className="p-6 text-sm text-muted-foreground">Carregando…</div>
        ) : admins.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            Nenhum administrador cadastrado.
          </div>
        ) : (
          <div className="overflow-x-auto"><table className="w-full text-sm min-w-[640px]">
            <thead className="bg-muted text-secondary">
              <tr className="text-left">
                <th className="px-4 py-3 font-semibold">Nome</th>
                <th className="px-4 py-3 font-semibold">E-mail</th>
                <th className="px-4 py-3 font-semibold">Grupos</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-t border-border align-top">
                  <td className="px-4 py-3 font-semibold text-secondary">{a.nome}</td>
                  <td className="px-4 py-3 text-muted-foreground">{a.email}</td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {a.usuarios_admin_grupos.length === 0 ? (
                      <span className="text-xs italic">sem grupos</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">
                        {a.usuarios_admin_grupos.map((l) => (
                          <span
                            key={l.id}
                            className="rounded-full bg-secondary/10 text-secondary px-2 py-0.5 text-xs font-medium"
                          >
                            {l.grupos_acesso?.nome ?? "—"}
                            {l.acesso_global ? " · global" : ""}
                          </span>
                        ))}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        a.status === "ativo"
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-zinc-200 text-zinc-700"
                      }`}
                    >
                      {a.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      <button
                        onClick={() => setEditing(a)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        <Pencil className="h-3 w-3" /> Grupos
                      </button>
                      <button
                        onClick={() => handleReset(a)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        <KeyRound className="h-3 w-3" /> Reset senha
                      </button>
                      <button
                        onClick={() => handleToggleStatus(a)}
                        className="inline-flex items-center gap-1 rounded-md border border-border px-2 py-1 text-xs font-semibold hover:bg-muted"
                      >
                        {a.status === "ativo" ? (
                          <>
                            <ShieldOff className="h-3 w-3" /> Desativar
                          </>
                        ) : (
                          <>
                            <ShieldCheck className="h-3 w-3" /> Ativar
                          </>
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table></div>
        )}
      </div>

      {openNew && (
        <NewAdminDialog
          grupos={grupos}
          ambientes={ambientes}
          onClose={() => setOpenNew(false)}
          onCreated={() => {
            setOpenNew(false);
            void load();
          }}
          invite={invite as any}
        />
      )}

      {editing && (
        <EditGroupsDialog
          admin={editing}
          grupos={grupos}
          ambientes={ambientes}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void load();
          }}
          updateGroups={updateGroups as any}
        />
      )}
    </div>
  );
}

function NewAdminDialog({
  grupos,
  ambientes,
  invite,
  onClose,
  onCreated,
}: {
  grupos: Grupo[];
  ambientes: Ambiente[];
  invite: (args: { data: any }) => Promise<{ id: string }>;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [usarSenha, setUsarSenha] = useState(false);
  const [senha, setSenha] = useState("");
  const [selected, setSelected] = useState<
    { grupo_id: string; acesso_global: boolean; ambiente_id: string | null }[]
  >([]);
  const [saving, setSaving] = useState(false);

  function toggleGrupo(g: Grupo) {
    setSelected((prev) => {
      const has = prev.find((x) => x.grupo_id === g.id);
      if (has) return prev.filter((x) => x.grupo_id !== g.id);
      return [
        ...prev,
        { grupo_id: g.id, acesso_global: g.escopo === "global", ambiente_id: null },
      ];
    });
  }

  function updateLink(grupo_id: string, patch: Partial<{ acesso_global: boolean; ambiente_id: string | null }>) {
    setSelected((prev) => prev.map((x) => (x.grupo_id === grupo_id ? { ...x, ...patch } : x)));
  }

  async function submit() {
    if (!nome.trim() || !email.trim()) return toast.error("Preencha nome e e-mail.");
    if (usarSenha && senha.length < 8) {
      return toast.error("A senha temporária precisa ter pelo menos 8 caracteres.");
    }
    setSaving(true);
    try {
      const payload: any = { nome, email, grupos: selected };
      if (usarSenha) payload.senha_temporaria = senha;
      await invite({ data: payload });
      toast.success("Administrador criado.");
      onCreated();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Novo administrador</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>Nome</Label>
            <Input value={nome} onChange={(e) => setNome(e.target.value)} />
          </div>
          <div>
            <Label>E-mail</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="rounded-md border border-border p-3 space-y-2">
            <label className="flex items-center gap-2 text-sm font-medium text-secondary">
              <input
                type="checkbox"
                checked={usarSenha}
                onChange={(e) => setUsarSenha(e.target.checked)}
              />
              Definir senha temporária agora
            </label>
            {usarSenha && (
              <div>
                <Input
                  type="text"
                  placeholder="Mínimo 8 caracteres"
                  value={senha}
                  onChange={(e) => setSenha(e.target.value)}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  O usuário poderá entrar imediatamente com essa senha. Recomende a troca no primeiro acesso.
                </p>
              </div>
            )}
            {!usarSenha && (
              <p className="text-xs text-muted-foreground">
                Sem senha definida, será gerado um link de redefinição para enviar ao usuário.
              </p>
            )}
          </div>
          <div>
            <Label>Grupos</Label>
            <div className="mt-2 space-y-2 max-h-72 overflow-auto border border-border rounded-md p-3">
              {grupos.length === 0 ? (
                <p className="text-xs text-muted-foreground">Nenhum grupo cadastrado.</p>
              ) : (
                grupos.map((g) => {
                  const link = selected.find((x) => x.grupo_id === g.id);
                  return (
                    <div key={g.id} className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={!!link}
                          onChange={() => toggleGrupo(g)}
                        />
                        <span className="font-medium text-secondary">{g.nome}</span>
                        <span className="text-xs text-muted-foreground">({g.escopo})</span>
                      </label>
                      {link && g.escopo !== "global" && (
                        <div className="ml-6 flex items-center gap-2 text-xs">
                          <label className="flex items-center gap-1">
                            <input
                              type="checkbox"
                              checked={link.acesso_global}
                              onChange={(e) =>
                                updateLink(g.id, { acesso_global: e.target.checked, ambiente_id: null })
                              }
                            />
                            Todos os ambientes
                          </label>
                          {!link.acesso_global && (
                            <select
                              value={link.ambiente_id ?? ""}
                              onChange={(e) =>
                                updateLink(g.id, { ambiente_id: e.target.value || null })
                              }
                              className="border border-border rounded px-1 py-0.5"
                            >
                              <option value="">Selecione ambiente…</option>
                              {ambientes.map((a) => (
                                <option key={a.id} value={a.id}>
                                  {a.nome}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Criando…" : "Criar e gerar link"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditGroupsDialog({
  admin,
  grupos,
  ambientes,
  updateGroups,
  onClose,
  onSaved,
}: {
  admin: Admin;
  grupos: Grupo[];
  ambientes: Ambiente[];
  updateGroups: (args: { data: any }) => Promise<any>;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [selected, setSelected] = useState(
    admin.usuarios_admin_grupos.map((l) => ({
      grupo_id: l.grupo_id,
      acesso_global: !!l.acesso_global,
      ambiente_id: l.ambiente_id,
    })),
  );
  const [saving, setSaving] = useState(false);

  function toggleGrupo(g: Grupo) {
    setSelected((prev) => {
      const has = prev.find((x) => x.grupo_id === g.id);
      if (has) return prev.filter((x) => x.grupo_id !== g.id);
      return [...prev, { grupo_id: g.id, acesso_global: g.escopo === "global", ambiente_id: null }];
    });
  }
  function updateLink(grupo_id: string, patch: any) {
    setSelected((prev) => prev.map((x) => (x.grupo_id === grupo_id ? { ...x, ...patch } : x)));
  }

  async function submit() {
    setSaving(true);
    try {
      await updateGroups({ data: { usuario_admin_id: admin.id, grupos: selected } });
      toast.success("Grupos atualizados.");
      onSaved();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Grupos de {admin.nome}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-96 overflow-auto border border-border rounded-md p-3">
          {grupos.map((g) => {
            const link = selected.find((x) => x.grupo_id === g.id);
            return (
              <div key={g.id} className="flex flex-col gap-1 border-b border-border/50 pb-2 last:border-0 last:pb-0">
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!link} onChange={() => toggleGrupo(g)} />
                  <span className="font-medium text-secondary">{g.nome}</span>
                  <span className="text-xs text-muted-foreground">({g.escopo})</span>
                </label>
                {link && g.escopo !== "global" && (
                  <div className="ml-6 flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1">
                      <input
                        type="checkbox"
                        checked={link.acesso_global}
                        onChange={(e) =>
                          updateLink(g.id, { acesso_global: e.target.checked, ambiente_id: null })
                        }
                      />
                      Todos os ambientes
                    </label>
                    {!link.acesso_global && (
                      <select
                        value={link.ambiente_id ?? ""}
                        onChange={(e) => updateLink(g.id, { ambiente_id: e.target.value || null })}
                        className="border border-border rounded px-1 py-0.5"
                      >
                        <option value="">Selecione ambiente…</option>
                        {ambientes.map((a) => (
                          <option key={a.id} value={a.id}>
                            {a.nome}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? "Salvando…" : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
