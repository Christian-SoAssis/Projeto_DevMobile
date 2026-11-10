# Validações e pendências — Enlace

> Itens pendentes de validação ou decisão. Quando um item for concluído, marcar com ✅ e mover a evidência para o histórico.  
> Letras sequenciais (A, B, C...); itens já concluídos não aparecem nesta lista.

---

## A — Verificação contra projeto Supabase real (segurança)

**O que falta:** aplicar o `supabase/init.sql` num projeto Supabase de verdade e conferir, na mão, que as políticas RLS, buckets e tabelas funcionam conforme especificado em `docs/arquitetura/05-sqlite-supabase-e-seguranca.md`.

**Por que importa:** os testes locais usam um `SupabaseFake` fiel ao SQL, mas isso não comprova o deploy real das políticas. Sem essa verificação, não há garantia de que escrita só do dono, leitura pública de anúncios visíveis e tabelas privadas estão realmente protegidas no servidor.

**Evidência necessária:** projeto Supabase criado, `init.sql` executado no SQL Editor, credenciais em `.env.local` (já existe), e confirmação de que:
- leitura pública exclui `HIDDEN`/`ADOPTED`;
- escrita de `animals`/`animal_photos` só do proprietário (`auth.uid()`);
- `favorites`/`adoption_interests` privados por `user_id`;
- moderação só via `is_admin()`.

---

## B — Chave do Google Maps no build próprio do Android

**O que falta:** preencher `android.config.googleMaps.apiKey` no `app.json` (estrutura já adicionada, valor vazio).

**Por que importa:** no Expo Go o mapa funciona sem a chave. Em build próprio de Android (EAS / `expo prebuild`), o mapa pode abrir em branco ou o build nativo pode falhar sem a chave da API do Google Maps.

**Observação:** a chave do iOS (Info.plist) é separada e ainda não foi tratada.

---

## C — Bloqueadores de produto (§4 de docs/nextsteps.md)

Precisam de decisão explícita de produto antes de serem implementados. Não implementar por suposição.

| # | Bloqueador | Antes de | Status |
|---|-----------|----------|--------|
| C.1 | Campos obrigatórios e limites de cada formulário | Passos 3/5 | Pendente |
| C.2 | Tipos de ação de moderação (ocultar, remover, suspender…) | Passo 5 | Pendente (HIDE/UNHIDE são mínimo provisório) |
| C.3 | Política de retenção de manifestações de interesse | Passos 3/5 | Pendente |
| C.4 | Precisão de anonimização de coordenadas | Passo 2 | Pendente (default proposto: 2 casas ≈ 1,1 km) |
| C.5 | Offline completo de favoritos/interesses (quais mutações entram na fila) | Passo 5 | Pendente (mapa atual: OFFLINE_PARTIAL) |

---

## D — Atividades remanescentes fora dos 5 passos (§3 de docs/nextsteps.md)

| # | Atividade | Detalhe |
|---|-----------|---------|
| D.1 | Medição de desempenho e escalabilidade (RNF13/14/15) | Valores propostos na doc §2.2: abertura de cache ≤ 1 s, operações remotas sem bloquear UI, listagem paginada/limitada no Supabase. **Não medidos.** Medir em aparelho real e registrar. |
| D.2 | Verificação de deep links | `scheme: "enlace"` ainda precisa ser verificado em aparelho. |

---

## E — Checklist de revisão de arquitetura (docs/arquitetura/06-checklist-de-revisao.md)

Todas as linhas (OFF-01 a DAT-12) começam como **NV (não verificado)**. Requerem inspeção contra o repositório e, em muitos casos, execução em aparelho físico.

**Lacunas já registradas no próprio checklist:**
- OFF-06 / OFF-08: triggers e índice do `init.sql` não aplicados num servidor real (ordem 8).
- Diversos itens exigem validação em dispositivo físico; não declarar sucesso em aparelho a partir de testes unitários apenas.

---

### Notas

- Itens B, C e D (validação manual em dispositivo, QA de navegação e QA de gesto/letterbox) foram reportados como já concluídos e, portanto, não constam desta lista.
- Não foram encontrados `TODO`, `FIXME`, `@ts-ignore` ou `@ts-expect-error` no `src/`. Os comentários com "pendente" no código são de negócio (fila, sincronização, offline), não dívidas de código.
- Não há `node_modules` instalado neste ambiente; para rodar `typecheck` ou `npm test`, usar `npm install --ignore-scripts` (o `better-sqlite3` falha na compilação normal via node-gyp sem Build Tools).
