# ADR 001 — Acesso ao SQLite: SQL cru nos repositórios (sem ORM), com reavaliação no Passo 3

- **Status:** Aceito (registrado no passo "Banco de dados local seguro e offline-first")
- **Data:** 01/11/2026
- **Regras ligadas:** `docs/nextsteps.md` §0.2 e §0.3 (domínio puro; aplicação sem SDK externo)

## Contexto

O passo exige uma **decisão sobre ORM** para o SQLite do app. O acesso atual é **SQL
cru escrito à mão** nos repositórios (`src/infrastructure/database/sqlite/repositories/`),
sobre o contrato próprio `SqliteDatabaseDriver` (`openDatabaseAsync` do `expo-sqlite`).
O `better-sqlite3` é apenas devDependency, para testar SQL de verdade no Jest.

## Decisão

**Manter SQL cru nos repositórios nesta fase.** Se (e quando) um ORM entrar, ele só pode
aparecer em `src/adapters/` e `src/infrastructure/` — nunca em `src/domain/` e
`src/application/`, que permanecem livres de SQLite, Expo e SDKs externos.

## Justificativa

1. **Corretude verificada na mão, mas verificada:** a suíte de integração real em
   `__tests__/integration/sqlite/real/` (better-sqlite3) já valida migrations, upserts
   idempotentes, rollback do `UnitOfWork`, fila com payload/tentativas e persistência
   ao reabrir o banco — os riscos que um ORM normalmente mitiga estão cobertos por
   testes de contrato.
2. **Zero dependência nativa em runtime:** um ORM adicionaria bundle e uma camada
   extra de driver (ex.: Drizzle + adapter do expo-sqlite) numa fase em que o app
   precisa gerar APK com build Expo estável (regra §0.1 do nextsteps).
3. **Controle fino já implementado:** upserts idempotentes, `PRAGMA user_version`
   para migrations, índices de busca/fila e transações aninhadas são declarados
   explicitamente no SQL — trocar por ORM não simplificaria, só transladaria.
4. **Prisma/TypeORM não suportam React Native bem;** Drizzle seria o único candidato
   viável, e exige migração de todos os repositórios de uma vez para não manter duas
   fontes de verdade.

## Consequências

- **Positivo:** menor superfície de dependência; aprendizado direto de SQL; testes
  de contrato continuam sendo a autoridade.
- **Negativo:** novas tabelas exigem SQL manual + teste real (pace um pouco maior).
- **Gatilho de reavaliação:** ao iniciar o **Passo 3 (Supabase)**, se a dose de SQL
  ad-hoc crescer (upgrade de migrations v2, filtros dinâmicos de busca), reabrir a
  decisão para Drizzle ORM no acesso SQLite — sempre restrito aos adapters/infrastructure.
