# ROADMAP.md — Migracao Supabase -> Self-Hosted (GSD)

Fonte unica de fases da migracao. Atualize este arquivo a cada task concluida.

## FASE 0 — Configuracao e Scaffolding

- [x] Task 0.1 — Guia de estilo nos arquivos de config
- [x] Task 0.2 — Scaffold do monorepo pnpm
- [x] Task 0.3 — Docker Compose baseline + limpeza Vercel/Lovable

## FASE 1 — Fundacao do Backend

- [x] Task 1.1 — Fastify server + config + health check
- [x] Task 1.2 — Schema Drizzle ORM + migrations

## FASE 2 — Autenticacao

- [x] Task 2.1 — JWT login + refresh + logout
- [x] Task 2.2 — Reset de senha + docs
- [x] Task 2.3 — Convite de admin

## FASE 3 — Autorizacao (substitui RLS)

- [x] Task 3.1 — Middleware RBAC para admin + hardening de escalada
- [x] Task 3.2 — Middleware de acesso de aluno

## FASE 4 — Endpoints CRUD Admin

- [x] Task 4.1 — Ambientes CRUD
- [x] Task 4.2 — Cursos, modulos, aulas CRUD
- [x] Task 4.3 — Ferramentas CRUD + sub-recursos
- [x] Task 4.4 — Alunos CRUD + importacao em lote
- [x] Task 4.5 — Trabalhos CRUD + acesso publico
- [ ] Task 4.6 — Novidades CRUD + webhook
- [ ] Task 4.7 — Grupos, permissoes, comentarios, logs, metricas

## FASE 5 — Endpoints do Aluno

- [ ] Task 5.1 — Home do aluno + dados do ambiente
- [ ] Task 5.2 — Player de aula + progresso + comentarios
- [ ] Task 5.3 — Detalhe de ferramenta + novidade

## FASE 6 — Migracao de Storage

- [ ] Task 6.1 — MinIO presigned URL service
- [ ] Task 6.2 — Migracao do ImageUpload no frontend

## FASE 7 — Migracao do Frontend

- [x] Task 7.1 — API client + integracao de auth
- [ ] Task 7.2 — Migrar arquivos `*.functions.ts` (um branch por arquivo)

## FASE 8 — Hardening

- [ ] Task 8.1 — Security headers + CORS allowlist
- [ ] Task 8.2 — Integracao do audit log
- [ ] Task 8.3 — Auditoria de validacao de inputs

## FASE 9 — CI/CD

- [ ] Task 9.1 — GitHub Actions CI para monorepo
