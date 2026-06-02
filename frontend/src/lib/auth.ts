import { getApiUser, signInWithApi, signOutWithApi, type BackendAuthUser } from "./backend-auth";

export type AdminProfile = {
  id: string;
  nome: string;
  email: string;
};

export async function signIn(email: string, password: string) {
  await signInWithApi(email, password, "admin");
  return { session: true };
}

export async function signUp(email: string, _password: string) {
  throw new Error(`Cadastro direto desabilitado para ${email}. Solicite convite de administrador.`);
}

export async function signOut() {
  await signOutWithApi();
}

export async function getAdminProfile(): Promise<AdminProfile | null> {
  const user = await getApiUser();
  if (!isAdmin(user)) return null;
  return { id: user.id, nome: user.nome, email: user.email };
}

export async function getAlunoProfile() {
  const user = await getApiUser();
  if (!isAluno(user)) return null;
  return { id: user.id, nome_completo: user.nomeCompleto, email_acesso: user.emailAcesso };
}

function isAdmin(user: BackendAuthUser | null): user is Extract<BackendAuthUser, { role: "admin" }> {
  return !!user && user.role === "admin";
}

function isAluno(user: BackendAuthUser | null): user is Extract<BackendAuthUser, { role: "aluno" }> {
  return !!user && user.role === "aluno";
}
