# STATE.md

## Current Milestone

- Migration from Supabase/Lovable to self-hosted backend/frontend integration.

## Current Focus

- Active task: `Task 7.2` from `ROADMAP.md`.
- Goal: migrate remaining `*.functions.ts` and remove Supabase runtime dependence in frontend flows.

## 7.2 Wave Status

- Wave 1 in progress: `admin-users.functions.ts` migrated to backend API wrapper (`admin-users.api.ts`).
- Frontend route updated: `admin.usuarios.tsx` now uses backend reset/status/groups/invite semantics.
- Wave 2 in progress: `trabalhos.functions.ts` migrated to backend API wrapper (`trabalhos.api.ts`).
- Backend added public endpoint `GET /trabalhos/ambiente?codigo=...` for code-based ambiente resolution.
- Public trabalho detail now returns funcionalidades + links + ambiente metadata via backend service.
- Wave 3 in progress: `ambiente-home.functions.ts` migrated to backend API wrapper (`ambiente-home.api.ts`).
- Backend added aluno endpoint `GET /aluno/ambientes/:slug/home` with aluno auth + ambiente scope middleware.
- Wave 4 in progress: `novidade.functions.ts` migrated to backend API wrapper (`novidade.api.ts`).
- Backend added aluno endpoint `GET /aluno/ambientes/:slug/novidades/:novidadeId` with UUID validation + auth/scope checks.
- Wave 5 in progress: `ferramenta.functions.ts` migrated to backend API wrapper (`ferramenta.api.ts`).
- Backend added aluno endpoint `GET /aluno/ambientes/:slug/ferramentas/:ferramentaId` with UUID validation + auth/scope checks.
- Verification: backend tests, frontend tests, and frontend build passing.

## Completed Through

- Fase 7.1 complete.

## Next Planned Steps

1. Plan Task 7.2 with TDD + security checklist.
2. Migrate next P1 file (`trabalhos.functions.ts`) to backend public endpoints.
3. Migrate next P1/P2 files (`aula-player.functions.ts`) to backend aluno endpoints.
4. Continue P2 files with tenant-scope regression tests.

## Risks Being Tracked

- Contract drift between backend auth claims and legacy frontend server-fns.
- Tenant-access regressions in ambiente routes during function migration.
- Remaining backend test gaps for auth/admin middlewares.
