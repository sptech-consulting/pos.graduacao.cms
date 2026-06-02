import {
  inviteAdminUserApi,
  sendAdminPasswordResetApi,
  setAdminUserStatusApi,
  updateAdminUserGroupsApi,
} from "./admin-users.api";

type GrupoInput = {
  grupo_id: string;
  acesso_global: boolean;
  ambiente_id?: string | null;
};

type InvitePayload = {
  nome: string;
  email: string;
  grupos: GrupoInput[];
};

export async function inviteAdminUser({ data }: { data: InvitePayload }) {
  return inviteAdminUserApi({ nome: data.nome, email: data.email });
}

export async function updateAdminUserGroups({
  data,
}: {
  data: {
    usuario_admin_id: string;
    grupos: GrupoInput[];
  };
}) {
  return updateAdminUserGroupsApi(data);
}

export async function setAdminUserStatus({
  data,
}: {
  data: { usuario_admin_id: string; status: "ativo" | "inativo" };
}) {
  return setAdminUserStatusApi(data);
}

export async function sendAdminPasswordReset({ data }: { data: { usuario_admin_id: string } }) {
  return sendAdminPasswordResetApi(data);
}
