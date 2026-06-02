# PLAN.md — Migração Supabase → Self-Hosted

Rastreador de tasks da migração. Cada task é discutida antes de executar, tem branch própria e PR ao final.

**Branch alvo dos PRs**: `refactor/loveable-migration`

**Protocolo de segurança:** toda task inclui análise de riscos e pen-test checklist — discutidos antes da execução.

**TDD obrigatório:** testes escritos ANTES da implementação. Ciclo Red → Green → Refactor → Secure. Nenhum PR sem testes passando — funcionais + hardening de segurança.

**Commits:** conventional commits, atômico por task. Branch a partir de `refactor/loveable-migration`. PR ao final.

---

## FASE 0 — Configuração & Scaffolding

- [x] **Task 0.1** — Adicionar guia de estilo aos arquivos de config do projeto
  `feat/project-config-files` · [PR #1](https://github.com/sptech-consulting/pos.graduacao.cms/pull/1)

- [x] **Task 0.2** — Scaffold do monorepo pnpm
  `feat/monorepo-scaffold` · [PR #2](https://github.com/sptech-consulting/pos.graduacao.cms/pull/2)

- [x] **Task 0.3** — Docker Compose baseline + limpeza Vercel/Lovable
  `feat/docker-compose` · [PR #3](https://github.com/sptech-consulting/pos.graduacao.cms/pull/3)

---

## FASE 1 — Fundação do Backend

- [x] **Task 1.1** — Fastify server + config + health check
  `feat/backend-server` · [PR #4](https://github.com/sptech-consulting/pos.graduacao.cms/pull/4)

- [x] **Task 1.2** — Schema Drizzle ORM + migrations
  `feat/drizzle-schema` · [PR #5](https://github.com/sptech-consulting/pos.graduacao.cms/pull/5)

---

## FASE 2 — Autenticação

- [x] **Task 2.1** — JWT login + refresh + logout
  `feat/auth-jwt` · [PR #6](https://github.com/sptech-consulting/pos.graduacao.cms/pull/6)

- [x] **Task 2.2** — Fluxo de reset de senha + Scalar docs
  `feat/password-reset` · [PR #7](https://github.com/sptech-consulting/pos.graduacao.cms/pull/7)

- [x] **Task 2.3** — Fluxo de convite de admin
  `feat/admin-invite` · [PR #10](https://github.com/sptech-consulting/pos.graduacao.cms/pull/10)

---

## FASE 3 — Middleware de Autorização (substitui RLS)

- [x] **Task 3.1** — Middleware RBAC para admin + hardening de escalada de privilégio
  `feat/rbac-middleware` · [PR #11](https://github.com/sptech-consulting/pos.graduacao.cms/pull/11)

- [x] **Task 3.2** — Middleware de acesso de aluno
  `feat/aluno-middleware` · [PR #13](https://github.com/sptech-consulting/pos.graduacao.cms/pull/13)

---

## FASE 4 — Endpoints CRUD Admin

- [x] **Task 4.1** — Ambientes CRUD
  `feat/admin-ambientes`

- [x] **Task 4.2** — Cursos, Módulos, Aulas CRUD
  `feat/admin-cursos`

- [x] **Task 4.3** — Ferramentas CRUD + sub-recursos
  `feat/admin-ferramentas`

- [x] **Task 4.4** — Alunos CRUD + importação em lote
  `feat/admin-alunos` · Substitui Edge Function admin-alunos

- [x] **Task 4.5** — Trabalhos CRUD + acesso público
  `feat/trabalhos`

- [ ] **Task 4.6** — Novidades CRUD + webhook
  `feat/novidades` · Substitui Edge Function novidades-webhook

- [ ] **Task 4.7** — Grupos, Permissões, Comentários, Logs, Métricas
  `feat/admin-rbac-logs`

---

## FASE 5 — Endpoints do Aluno

- [ ] **Task 5.1** — Home do aluno + dados do ambiente
  `feat/aluno-home`

- [ ] **Task 5.2** — Player de aula + progresso + comentários
  `feat/aluno-player`

- [ ] **Task 5.3** — Detalhe de ferramenta + novidade
  `feat/aluno-content`

---

## FASE 6 — Migração de Storage

- [ ] **Task 6.1** — MinIO presigned URL service
  `feat/storage`

- [ ] **Task 6.2** — Migração do ImageUpload no frontend
  `feat/frontend-storage`

---

## FASE 7 — Migração do Frontend

- [ ] **Task 7.1** — API client + integração de auth
  `feat/frontend-auth` · Substitui integrations/supabase/ por integrations/api/

- [ ] **Task 7.2** — Migrar arquivos `*.functions.ts` (um branch por arquivo)
  `feat/frontend-fn-*` · 11 arquivos, ordem por profundidade de dependência

---

## FASE 8 — Hardening

- [ ] **Task 8.1** — Security headers + CORS
  `feat/security-headers` · @fastify/helmet, CORS allowlist

- [ ] **Task 8.2** — Integração do audit log
  `feat/audit-log` · audit.service.ts, IP capture, failed auth logging

- [ ] **Task 8.3** — Auditoria de validação de inputs
  `feat/input-validation` · Revisão de todos os schemas Fastify

---

## FASE 9 — CI/CD

- [ ] **Task 9.1** — GitHub Actions CI para monorepo
  `feat/ci-pipeline` · Jobs separados por workspace (backend/frontend), path filters, bloqueia PR se testes falharem
