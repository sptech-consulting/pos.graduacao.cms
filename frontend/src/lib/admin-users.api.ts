import { apiRequest } from "./api-client";
import { readAccessToken } from "./backend-auth";

type GrupoPayload = {
  grupo_id: string;
  acesso_global: boolean;
  ambiente_id?: string | null;
};

type InvitePayload = {
  nome: string;
  email: string;
};

type UpdateGroupsPayload = {
  usuario_admin_id: string;
  grupos: GrupoPayload[];
};

type UpdateStatusPayload = {
  usuario_admin_id: string;
  status: "ativo" | "inativo";
};

type ResetPayload = {
  usuario_admin_id: string;
};

function requireToken(): string {
  const token = readAccessToken();
  if (!token) {
    throw new Error("Sessao expirada. Faca login novamente.");
  }

  return token;
}

function toBackendGrupoIds(grupos: GrupoPayload[]): string[] {
  return grupos.map((item) => item.grupo_id);
}

function toAmbienteId(grupos: GrupoPayload[]): string | undefined {
  const scoped = grupos.find((item) => !item.acesso_global && item.ambiente_id);
  return scoped?.ambiente_id ?? undefined;
}

export async function inviteAdminUserApi(payload: InvitePayload) {
  const token = requireToken();
  return apiRequest<{ id: string }>("/admin/usuarios", {
    method: "POST",
    token,
    body: payload,
  });
}

export async function updateAdminUserGroupsApi(payload: UpdateGroupsPayload) {
  const token = requireToken();
  return apiRequest<{ id: string }>(`/admin/usuarios/${payload.usuario_admin_id}/grupos`, {
    method: "PATCH",
    token,
    body: {
      grupoIds: toBackendGrupoIds(payload.grupos),
      ambienteId: toAmbienteId(payload.grupos),
      acessoGlobal: payload.grupos.some((item) => item.acesso_global),
    },
  });
}

export async function setAdminUserStatusApi(payload: UpdateStatusPayload) {
  const token = requireToken();
  return apiRequest<{ id: string }>(`/admin/usuarios/${payload.usuario_admin_id}/status`, {
    method: "PATCH",
    token,
    body: { status: payload.status },
  });
}

export async function sendAdminPasswordResetApi(payload: ResetPayload) {
  const token = requireToken();
  return apiRequest<{ message: string }>(`/admin/usuarios/${payload.usuario_admin_id}/reset-password`, {
    method: "POST",
    token,
  });
}
