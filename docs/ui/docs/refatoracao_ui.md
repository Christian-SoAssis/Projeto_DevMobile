# Refatoração UI do Enlace — Guia técnico completo para o redesign

> **Entregável:** documentação de implementação da nova UI a partir das duas
> pranchas geradas, preservando **100% das funcionalidades** verificáveis.
> Este guia só entra em implementação quando o usuário solicitar.
>
> **Estado do código inspecionado (UI-01):** commit `9791a77` — "docs: add
> implementation guidelines and UI redesign instructions", working tree limpo.
> Suíte de referência: **428 testes / 66 suítes verdes**, typecheck 0 erros
> (após ordens 1, 3, 4, 5 e 7 — `docs/nextsteps_arquitetura.md` §7).

---

## 1. Escopo, referências e evidências

### 1.1 Fontes reais utilizadas (caminhos verificados)

| Fonte | Caminho | Uso |
| --- | --- | --- |
| Prancha 1 — "Encontre um novo amor" (V01–V08) | `docs/ui/images/Painel Enlace com logos de pets-2.png` | Composição, claymorphism, hierarquia |
| Prancha 2 — "Cuidar de cada história" (V09–V16) | `docs/ui/images/Reparo do emblema Enlace em telas móveis-1.png` | Idem |
| Instruções normativas do redesign | `docs/ui/docs/instrucoes_iniciais.md` | Regras UI-01…UI-14 |
| Doc principal (requisitos, RFs, offline, RLS) | `docs/documentacao-software-rede-adocao-animais.md` | Escopo funcional, RF01–RF23+, doc § |
| Arquitetura (checklist + docs temáticos) | `docs/arquitetura/` (06-checklist-de-revisao.md etc.) | Contratos T01–T28, regras OFF/PER/CAP/MID/DAT |
| Plano de arquitetura em curso | `docs/nextsteps_arquitetura.md` (§7: ordens concluídas) | Eventos, contratos novos |
| Instruções de decisão pendente | `docs/instrucoes_para_as_ordens.md` | Itens 🔒 (0/2/6) e 🌐 (8) — fora do escopo visual |
| Código | `app/` (16 arquivos: 13 rotas + 3 layouts), `src/adapters/` (telas, hooks, guards), `src/application/`, `src/domain/`, `src/infrastructure/` | Comportamentos, testIDs, use cases |
| Testes | `__tests__/` (19 arquivos .tsx de UI/e2e/map + suítes de domínio/aplicação/infra) | Rede de proteção funcional |

**Sem acesso ("não verificado") neste ambiente:** aparelho físico, build
nativa, `react-native-maps` real no device (unit tests usam o fallback
`map-view`), políticas RLS aplicadas a servidor real. Nada disso é assumido
como funcionando (UI-14).

### 1.2 Divergência de entregável (registrada, corrigida nesta versão)

- `instrucoes_iniciais.md` §5 determina `docs/ui/UI_IMPLEMENTATION_GUIDE.md`.
- A instrução explícita do usuário (06/11/2026) determina
  **`docs/ui/docs/refatoracao_ui.md`**.
- Pela regra de resolução de divergências (instruções §3, item 1: "Instruções
  explícitas do usuário definem o escopo"), prevalece o caminho do usuário.
  As correções ao arquivo de instruções foram aplicadas após autorização
  explícita (seção 12.1).

### 1.3 O que este guia é e não é

- **É:** especificação implementável (tokens, componentes, 16 telas, estados,
  papéis, acessibilidade, plano incremental e de validação) com base exclusiva
  nas duas pranchas + código + docs.
- **Não é:** implementação já executada nem aprovação visual em device
  (UI-14: nenhuma validação em device foi executada além da suíte baseline 428/428 citada).
- **Não altera:** regras de negócio, ordens 🔒 pendentes (ordens 0/2/6) nem o
  escopo da ordem 8 (ambiente real).

---

## 2. Inventário de telas, rotas, variantes e papéis (UI-06)

### 2.1 Rotas existentes (evidência: `app/` — 16 arquivos: 13 rotas + 3 layouts)

| Rota | Arquivo | Componente de tela | Guarda |
| --- | --- | --- | --- |
| Login | `app/login.tsx` | `src/adapters/screens/LoginScreen.tsx` | pública |
| Cadastro | `app/cadastro.tsx` | `RegisterScreen.tsx` | pública |
| Explorar (busca + mapa + filtros) | `app/(tabs)/index.tsx` | `SearchScreen.tsx` + `src/adapters/map/AnimalMap.tsx` | pública |
| Detalhes | `app/animal/[id].tsx` | `AnimalDetailsScreen.tsx` | pública (ações por papel) |
| Favoritos | `app/(tabs)/favoritos.tsx` | `FavoritesScreen.tsx` | AUTHENTICATED (`AccessPolicy.FAVORITES`) |
| Meus anúncios | `app/(tabs)/meus-anuncios.tsx` | `MyAnimalsScreen.tsx` | AUTHENTICATED |
| Sincronização | `app/(tabs)/sync.tsx` | `SyncStatusScreen.tsx` | AUTHENTICATED |
| Moderação | `app/(tabs)/moderacao.tsx` | `ModerationScreen.tsx` | ADMIN |
| Conta | `app/(tabs)/conta.tsx` | `AccountScreen.tsx` (visitor + perfil) | pública com 2 estados |
| Novo anúncio | `app/(protected)/novo-anuncio.tsx` | `AnimalFormScreen.tsx` (modo criar) | AUTHENTICATED |
| Editar anúncio | `app/(protected)/editar-anuncio.tsx` | `AnimalFormScreen.tsx` (modo editar, params id) | AUTHENTICATED |
| Conflitos | `app/(protected)/conflitos.tsx` | `ConflictReviewScreen.tsx` | AUTHENTICATED |

Estrutura de navegação (evidência): `app/_layout.tsx` (provê AuthContext +
RepositoriesContext + AutoSync), `app/(tabs)/_layout.tsx` (Tabs com 6 abas e
`canAccess()` ocultando abas restritas — `src/domain/services/AccessPolicy.ts`),
`app/(protected)/_layout.tsx` (grupo protegido). Além desses, `app/index.tsx`
é o **redirect raiz** (`<Redirect href="/(tabs)" />` — evid. `app/index.tsx:5`).

### 2.2 Mapeamento pranchas → rotas (16 visualizações × rotas reais)

| ID | Visualização (prancha) | Rota/estado real | Compartilhamento | Papéis |
| --- | --- | --- | --- | --- |
| V01 | Entrar | `app/login.tsx` | — | visitante (autenticado redireciona) |
| V02 | Criar conta | `app/cadastro.tsx` | — | visitante |
| V03 | Explorar · Lista | `(tabs)/index.tsx` — `viewMode='list'` | **mesma rota de V04/V05** | todos (visitante incluído) |
| V04 | Explorar · Mapa | idem — `viewMode='map'` | idem | todos |
| V05 | Filtros da busca | **novo componente** `FilterSheet` dentro da busca (DECISÃO: prancha usa bottom sheet; hoje os filtros são chips inline `filter-chip-*`/inputs) | montada na rota da busca | todos |
| V06 | Detalhes · Adoção | `app/animal/[id].tsx` — estado público | **mesma rota de V16** | todos |
| V07 | Favoritos | `(tabs)/favoritos.tsx` | — | autenticado |
| V08 | Conta · Visitante | `AccountScreen.tsx` — `account-visitor` | mesma rota de V12 | visitante |
| V09 | Meus anúncios | `(tabs)/meus-anuncios.tsx` | — | autenticado |
| V10 | Novo anúncio | `AnimalFormScreen.tsx` (`isEdit=false`) | **mesmo componente de V11** | autenticado |
| V11 | Editar anúncio | `AnimalFormScreen.tsx` (`isEdit=true`) | idem | responsável do anúncio |
| V12 | Conta · Perfil | `AccountScreen.tsx` — `account-user` | mesma rota de V08 | autenticado |
| V13 | Sincronização | `(tabs)/sync.tsx` | — | autenticado |
| V14 | Revisar alterações | `app/(protected)/conflitos.tsx` | — | responsável (dono do item) |
| V15 | Moderação | `(tabs)/moderacao.tsx` | — | administrador |
| V16 | Detalhes · Responsável | `animal/[id].tsx` — estado dono (`mark-adopted-button`, `received-interests`) | idem V06 | dono do anúncio |

Diferenças prancha ≠ código (todas registradas; nenhuma altera requisito):

1. **Tab bar:** pranchas exibem 5 abas (V15 troca "Favoritos" por "Moderação"
   com a aba central destacada). Código atual: 6 abas (favoritos e moderação convivem,
   ocultas por papel). **Regra vigente preservada** (UI-06/UI-07): todas as
   áreas continuam navegáveis conforme `AccessPolicy`; a proposta visual usa as
   5 posições da prancha e a aba de moderação aparece no espaço da central **para
   administrador**; "Favoritos" permanece visível para quem não é admin. Para
   admin, "Favoritos" fica acessível via Conta/atalho (DECISÃO registrada; não
   remove acesso — matriz completa na seção 7).
2. **V05 filtros:** hoje inline (chips + `search-age-input` + 2 botões de
   buscar). Prancha: **bottom sheet** com Limpar/Aplicar. DECISÃO: mover os
   controles existentes para o sheet, mantendo TODO `testID` existente e a
   busca aplicada ao confirmar (novos ids: `filter-clear`/`filter-apply`).
3. **V03 "Dados atualizados":** não existe hoje. DECISÃO: indicador ligado ao
   evento de pull concluído (ordem 4 concluída — `src/adapters/sync/pullEvents.ts`),
   **nunca** exige afirmação "sincronizado" sem confirmação (UI-09).
4. **V09/V10/V11 flag "Salvo no aparelho":** hoje existe indicação parcial
   (`photo-status`, `location-status`). DECISÃO: componente único `SavedOnDeviceBadge`
   refletindo estados reais (payload `SYNCING/FAILED/COMPLETED` da fila — sem
   inventar estado).
5. **V01/V02 olho de senha (toggle visibilidade):** novo componente visual
   (`SecureField`), comportamento idêntico (auth pelo mesmo `AuthenticateUserUseCase`).
6. **V12 "Interesses de adoção" (chips de perfil):** **não existe** controle no
   código. UI-07 proíbe adicionar funcionalidade por espaço visual →
   **PENDÊNCIA de decisão de produto**; enquanto isso, a seção não será
   renderizada como controle funcional (apenas espaço reservado opcional).
7. **V06 descrição do animal ("Carinhosa..."):** hoje o detalhe usa
   `characteristics.summary()`; não há campo de texto livre. Pendência de
   decisão (campo de descrição) — fora do redesign, registrado.
8. **Botões Câmera/Galeria (V10/V11/V12):** já existem (`btn-capture-photo`,
   `btn-pick-gallery`, `avatar-camera`, `avatar-gallery`) via
   `ImagePickerCameraAdapter` (Galeria/Câmera nativa do sistema — UI-06: não há
   telas próprias para fluxo nativo; a prancha só adorna o gatilho).

---

## 3. Inventário de assets e fontes

### 3.1 Evidência (o que existe)

| Item | Estado |
| --- | --- |
| Pasta `assets/` | **Inexistente** no repositório (glob `assets/**/*` → vazio) |
| Asset da logo (cão branco + gato laranja + contorno marrom) | **Inexistente** como arquivo — presente **apenas** como recorte extraível das pranchas |
| Fontes `.ttf`/`.otf` | Inexistentes |
| `expo-font` | Instalado (`package.json` dependência `~58.0.11`) — pronto para carregar fontes |
| Ícones | `@expo/vector-icons` **Ionicons** (usado nas tabs hoje, evidência `app/(tabs)/_layout.tsx`) |
| Sem biblioteca de UI | Correto para o projeto (UI-12) |

### 3.2 Logo (UI-02)

- **REQUISITO:** contorno marrom contínuo na região posterior do gato; um único
  asset canônico; um único componente compartilhado (`EnlaceLogo`).
- **PENDÊNCIA concreta:** **o asset final não existe no projeto**. Prancha não
  pode ser declarada asset de marca (resolução/integridade não verificadas).
  **Ação necessária do usuário:** fornecer `assets/images/logo-enlace.png`
  (ideal ≥ 512px, fundo transparente, contorno contínuo verificado).
- **Proposta de componente enquanto a pendência existe:** `EnlaceLogo` degrada
  para marca textual ("Enlace" em tipografia token
  `display`) — nunca pata genérica, nunca recorte da prancha em runtime.
- **Variantes previstas (DECISÃO):** `hero` 112×112 (V01/V02/V08),
  `header` 36×36 (V03/V04/V07/V09/V12/V13/V15), `inline` 24×24 (aplicações
  menores). Proporção preservada (`resizeMode: 'contain'`, margem livre
  ≥ 0,25× a altura do emblema em cada lado).

### 3.3 Tipografia (UI-03)

- **Base normativa:** Arial Black (títulos/marca), DejaVu Sans (texto).
- **Não há arquivos de fonte no repo**, e esses nomes não são garantidos nos
  sistemas-alvo (UI-03).
- **DECISÃO de fallback imediata (sem asset):** tokens tipográficos que usam
  `fontWeight: '900'`+`letterSpacing` (RN aplica peso real da família do
  sistema) e `fontFamily` **não setado** para texto corrente (Roboto/SF). A
  camada `typography.ts` centraliza; quando o usuário fornecer
  `assets/fonts/ArialBlack.ttf` + fallback open-source equivalente
  (ex.: `Noto Sans` para texto), o carregamento é feito **uma única vez** em
  `app/_layout.tsx` via `expo-font` e os tokens passam a apontar os `fontFamily`.
  Substituição registrada e auditável (UI-03).

---

## 4. Tokens visuais (valores, unidades, papéis, origem)

### 4.1 Cores (base normativa UI-03 + decisões derivadas calculadas)

| Token | Valor | Papel | Contraste verificado |
| --- | --- | --- | --- |
| `bg.canvas` | `#FDF7F0` (marfim) | fundo de tela | base |
| `bg.surface` | `#FDF1E6` (creme) | cartões/superfícies | par com `text.primary` 14,2:1 |
| `bg.recessed` | `#F6D3BC` (pêssego) | campos rebaixados, hero-soft | par com `text.primary` 10,8:1 |
| `bg.overlay` | `rgba(58,31,20,0.45)` | scrim em bottom sheet | DECISÃO |
| `text.primary` | `#3A1F14` | texto principal | ≥ 14,2:1 sobre superfícies |
| `text.secondary` | `#5C4033` | texto secundário/hint | 8,8:1 |
| `action.base` | `#C2512E` (terracota) | botão primário identidade | texto **branco** sobre base: **4,66:1** ✓ AA |
| `action.strong` | `#B54526` | pressed do botão primário | DECISÃO (≥ base) |
| `accent.base` | `#D9643A` (laranja) | destaques/ícones | texto branco sobre laranja: **3,6:1 ≥ 3:1 → só texto ≥18px bold/ícones** |
| `success.base` | `#2F6B42` | badge Disponível/Visível, check | texto branco sobre verde: **6,36:1** ✓ |
| `warn.bg` | `#F7D774` | alerta revisão — **DECISÃO** (fora da paleta base) | texto `#3A1F14` sobre warn **≥ 9:1** ✓ |
| `error.base` | `#9B3B2E` | erro/form feedback — **DECISÃO** | texto branco **≥ 4,5:1** (variante escura da terracota) |
| `border.soft` | `#EAD3C0` | borda de cartão/campo — **DECISÃO** | decorativa (não-carrega significado) |
| `line.focus` | `#C2512E` | anel de foco (2px) | combinado com icon/label — indicador nunca **só** de cor (UI-11) |
| `tab.active` | `#C2512E` / `tab.inactive` `#8A7B70` | tab bar | ícones + **rótulo** (estado não depende só de cor) |

Regra de uso (UI-11): `accent.base` **não** sustenta texto normal (<4,5:1) —
limitado a ícones/detalhes; toda ação primária usa `action.base`.

### 4.2 Tipografia (tamanhos em dp/sp)

| Token | Valor | Uso |
| --- | --- | --- |
| `type.display` | 34/40 · 900 | "Encontre seu novo amigo" |
| `type.title` | 24/30 · 900 | títulos de seção, "Moderação" |
| `type.cardTitle` | 17/22 · 900 | nome do animal |
| `type.body` | 15/21 · 400 (`line-height` 1.4) | corrente |
| `type.caption` | 12/16 · 600 | chips, badges, observações |
| `type.cta` | 16/20 · 900 | rótulo de botão |

### 4.3 Espaçamento, raios, bordas, sombras (claymorphism, UI-04)

- **Escala de espaçamento (DECISÃO):** 4 · 8 · 12 · 16 · 20 · 24 · 32.
- **Raios (DECISÃO):** `r-sm 12` (chip/campo), `r-md 20` (cartão), `r-lg 28`
  (botão primário/hero/header pill), `r-full` (pill).
- **Cartão (clay):** raio 20 · fill `bg.surface` · sombra dupla —
  *drop*: `shadowColor #E8B49A, opacity 0.55, radius 18, offset (0,10)` +
  *highlight* borda interna `rgba(255,255,255,0.65)` 1px (elevação suave).
  No Android: `elevation 6` + `shadowColor` equivalente (comportamento a testar
  por plataforma — pendência de device, UI-04).
- **Campo (rebaixado):** fill `bg.recessed` · raio 12 · **inset** `rgba(194,81,46,0.12)` 1.5px · sem sombra externa.
- **Botão primário:** fill `action.base` · raio 28 · altura 52 · sombra
  `#E8B49A opacity 0.6 radius 12 offset (0,6)` · pressed: fundo `action.strong` +
  `transform scale 0.97` (150ms) — estado além do relevo (UI-04).
- **Botão secundário:** fill `bg.surface` · raio 28 · borda `border.soft` 1.5px · mesmo padrão de altura.
- **Pill de status (badge):** raio full · altura 28 · padding horizontal 10 ·
  texto `type.caption` branco (ou `text.primary` sobre fundos claros).

### 4.4 Dimensões de toque e imagem

- **Área de toque:** ≥ 48×48 (atingido pelos chips com padding 12 + altura 36 + hitSlop 8).
- **Foto de card:** 4:3, `resizeMode cover`, raio `r-sm`; detalhe (hero): 16:9.
- **Miniaturas:** a lista usa o mesmo cache do componente `Image` do RN; originais carregam
  só em detalhe (UI-13) — orçamentos na seção 9.

---

## 5. Catálogo de componentes compartilhados (UI-05)

Todos em `src/adapters/ui/` (novo, camada adapters — UI-12): nenhum toque em
`application/`, `domain/`, `infrastructure/`.

| Componente | Responsabilidade | Variantes | Dados/events | Estados (UI-09) |
| --- | --- | --- | --- | --- |
| `ClayButton` | ação primária/secundária | `primary` \| `secondary` \| `destructive` \| `ghost` | `label`, `onPress`, `disabled`, `accessibilityLabel`, opcional `testID` | padrão/pressed/disabled; loading opcional com ActivityIndicator e `accessibilityState.busy` |
| `ClayField` | entrada de texto estilizada | `text` \| `secure` (olho) \| `multiline` | `label`, `value`, `onChangeText`, `keyboardType`, `placeholder`, `testID` **preservado do app atual** | foco (anel `line.focus`), erro (msg abaixo, `accessibilityLabel` de erro), disabled |
| `Chip` | seleção rápida | `select` \| `icon` | `label`, `selected`, `onPress`, `testID` | default/selected; selecionado por **fundo + check + peso** (não só cor) |
| `StatusBadge` | rótulo de situação | `available` \| `adopted` \| `visible` \| `hidden` \| `pending` \| `review` \| `owner` | `status` mapeia `SyncState`/`AnimalStatus` | sempre com **texto**, nunca só cor (UI-09/UI-11) |
| `AnimalCard` | item de lista | `discovery` (V03/V07) \| `management` (V09/V15) | `animal`, `isFavorite?`, `onPress`, `onToggleFavorite?`, `onEdit/onAdopted/onDelete?` (management) | loading de imagem (placeholder `bg.recessed`), falha de foto (iniciais sobre fundo), favorited (coração preenchido + `accessibilityState.selected`) |
| `HeroPhoto` | foto full-bleed | `details` (16:9) \| `form` | `uri`, `fallbackIcon`, `children` (overlays) | carregando/falha/placeholder |
| `SearchHeader` | cabeçalho de tela | `search` \| `plain` | logo + localização (região) + título | — |
| `OfflineBanner` | aviso de conexão/sync | `text` \| `check` ("Dados atualizados") | `state` do `SearchAnimalsUseCase` + evento `onPullCompleted` (ordem 4) | offline (fixo), atualizado (texto inclui hora do último pull) |
| `FilterSheet` | bottom sheet de filtros | única (V05) | filtros do `SearchAnimalsUseCase`, `onClear`, `onApply` | aberto/fechado/sheet-focus |
| `SavedOnDeviceBadge` | estado offline por anúncio | única | pendência da fila do anúncio (payload/`SyncState`) | saved / waiting / syncing / needs-review (mapear 1:1 estados reais) |
| `EmptyState` | vazio/ilustração | `favorites` \| `search` \| `sync` \| `myAnimals` \| `moderation` | `title`, `message` | — |
| `TabBarClay` | navegação por abas | única (clay) | Tabs do expo-router (mesma lógica `canAccess`) | active/inactive com ícone **+** rótulo |
| `EnlaceLogo` | marca | `header` \| `hero` \| `text` | conforme 3.2 | fallback textual |

Regra: **nenhum estilo duplicado por tela**; toda cor/espaçamento/raio vem de
`src/adapters/ui/theme.ts`. Os `testID`s agora são contratos de cada
componente (passados por prop) — tabela completa por tela a seguir.

---

## 6. Especificação por tela (16 visualizações)

> Campos do modelo da seção 5 das instruções, compactados em tabelas.
> "Caso de uso" = **evidência** do código atual (import/new); "testIDs" são os
> contratos atuais que a implementação PRESERVA.

### V01 — Entrar (login)

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 1, tela 01 |
| Rota/componente | `app/login.tsx` → `LoginScreen.tsx` (`testID login-screen`) |
| Papel/acesso | visitante; autenticado já sai por redirect do layout |
| Objetivo | autenticar para favoritar/interessar/anunciar |
| Composição | EnlaceLogo hero → título "Que bom te ver!" → card clay: campo e-mail (ícone), campo senha + olho (`SecureField`) → `ClayButton` primary "Entrar" → secundário "Criar conta" → ghost "Continuar como visitante" |
| Dados | e-mail/senha → `input-email`, `input-pass` (preservados); demo hint atual (`login-demo-hint`) **mantido** como caption discreta (UI-07: não remover funcionalidade por estética) |
| Interações | Entrar → `AuthenticateUserUseCase` (evid. `LoginScreen.tsx:49`) → sucesso navega `(tabs)`; "Criar conta" → `/cadastro`; "Continuar" → `(tabs)` como visitante |
| Estados | carregando (button busy), erro (banner `login-feedback` mensagem de produto, sem detalhe técnico UI-09), sucesso (navegação) |
| Adaptação | rolagem com teclado aberto (`ScrollView` + `KeyboardAvoidingView`), campos com altura 52dp (mínimo 48dp) |
| Acessibilidade | campo com `accessibilityLabel` "E-mail"/"Senha", botão olho com estado "oculto/exibindo" |
| Aceite | `AuthScreens.test.tsx` passa sem mudar seletores; visual conferido contra prancha 01 |
| Pendências | fonte **Arial Black** asset (3.3) |

### V02 — Criar conta

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 1, tela 02 |
| Rota | `app/cadastro.tsx` → `RegisterScreen.tsx` (`register-screen`) |
| Papel | visitante |
| Composição | logo compacta → "Uma nova história começa aqui." → campos: Nome (`input-name`), E-mail (`input-email`), Telefone (`input-phone`), Senha (`input-pass` + olho), Confirmar (`input-confirm-pass` + olho) → primary "Criar conta" → link "Já tem conta? Entrar" (`link-login`) |
| Dados/interações | cadastro via use case de registro atual (evid. RegisterScreen + `AuthContext`); telefone mantém máscara de entrada livre atual |
| Estados | erro de validação/servidor no banner `register-feedback`; campos com erro recebem `error.base` + mensagem |
| Ajuste visual (DECISÃO) | olho nas duas senhas (não muda o contrato); demais igual prancha |
| Aceite | `AuthScreens.test.tsx` |

### V03 — Explorar · Lista

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 1, tela 03 |
| Rota | `(tabs)/index.tsx` → `SearchScreen.tsx` (`search-screen`), `viewMode='list'` |
| Papel | **todos**, incluindo visitante |
| Composição | `SearchHeader` (logo + região) → título "Encontre seu novo amigo" → input busca (`search-input`) + botão filtros (abre `FilterSheet`, V05) → chips espécie (`filter-chip-Todos/Cão/Gato` com ícone paw/cat) → `OfflineBanner` (`connection-banner`, variante check quando último pull OK) → toggle Lista/Mapa (`toggle-list`/`toggle-map`) → FlatList (`animals-list`) de `AnimalCard discovery` |
| Card | foto 4:3 + nome (`type.cardTitle`) + `StatusBadge available/adopted` + coração (favoritar **se autenticado**; visitante vê botão que navega para V08 com aviso — comportamento atual preservado) + chips ícone (idade • sexo, porte, localização) |
| Dados | `SearchAnimalsUseCase` (`SearchScreen.tsx:55`) sobre repositório; **re-consulta automática** ao pull (ordem 4: `onPullCompleted` → re-search — preservar!); filtros espécie/porte/sexo/idade como hoje |
| Interações | tocar card → detalhes (`animal-card-*`); coração → `ToggleFavoriteUseCase` (autenticado) |
| Estados | loading (`loading-indicator`), vazio (`empty-message`) com `EmptyState` ilustrado, offline banner persiste, "Dados atualizados · hh:mm" após pull |
| A11y | lista com `accessibilityRole="list"`; card com role button + label composto |
| Aceite | `SearchScreenSyncRefresh.test.tsx`, `Screens.test.tsx` e e2e `SearchToDetails.test.tsx` verdes com os mesmos `testID`s |

### V04 — Explorar · Mapa

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 1, tela 04 |
| Rota | mesma rota da busca, `viewMode='map'` |
| Composição | toggle no topo (mesmos `testID`s) → mapa com pins de patinha (`native-map`/fallback `map-view`) → **card inferior deslizável** do animal selecionado (foto, nome, bairro·cidade, `ClayButton` "Ver anúncio", nota "Localização aproximada") |
| Privacidade | `approx-location`/`map-privacy-note` **preservados** — nunca pin no endereço exato (regras MID/PER + doc §localização aproximada) |
| Dados | `AnimalMap.tsx` (evid.) — mesma fonte de dados da V03 |
| Estados | mapa indisponível (web/jest): fallback com lista compacta (comportamento atual mantido) |
| Aceite | `AnimalMap.test.tsx` + `AnimalMapFallback.test.tsx` |

### V05 — Filtros da busca (bottom sheet)

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 1, tela 05 |
| Componente | `FilterSheet` (novo) montado dentro da rota da busca |
| Papel | todos |
| Composição | seções: Espécie (Todos/Cães/Gatos), Porte (Todos/Pequeno/Médio/Grande), Sexo (Todos/Macho/Fêmea), Idade aproximada (`search-age-input`); footer: ghost "Limpar" + primary "Aplicar filtros" |
| Contratos | **mesmos** `testID`s dos filtros atuais (`filter-chip-*`, `filter-sex-*`, `search-age-*`); novos ids só para os botões do sheet (`filter-clear`, `filter-apply` — DECISÃO) |
| Interações | Aplicar → re-executa busca com filtros; Limpar → reseta; sheet fecha; estado parcial refletido nos chips inline da V03 (não duplicado) |
| Estado | chips selecionados com check, não só fundo |
| Adaptação | sheet com altura ≤ 70% da tela, rolagem interna quando o teclado abre |
| A11y | `accessibilityRole="dialog"` com título; foco inicial no primeiro grupo |

### V06 — Detalhes · Adoção (público)

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 1, tela 06 |
| Rota | `app/animal/[id].tsx` → `AnimalDetailsScreen.tsx` (`animal-details-screen`) — estado público |
| Composição | `HeroPhoto` 16:9 com back (`back-button`) + coração (`favorite-button`) → nome (`animal-title`) + badge → linha de chips ícone: idade, sexo, porte, espécie (`info-species/size/age/sex` — **preservados**, agora com ícone) → descrição/summary (`characteristics.summary()`) → localização `approx-location` + "O endereço exato não é exibido." → `ClayButton` primary "Demonstrar interesse" (`interest-button`) → secondary "Gerar PDF do anúncio" (`export-pdf-button`) |
| Papéis | favoritar/interessar: autenticado; **visitante vê CTAs desativados com navegação para V08** (mesma política atual; nada removido). Botão de interesse só quando status AVAILABLE (atual) |
| Dados/interações | `ToggleFavoriteUseCase` (`:110`), `RegisterAdoptionInterestUseCase` (`:125`), `GerarPdfUseCase` (`:152`) — todos preservados |
| Estados | feedback `feedback-message` (sucesso/erro em texto, com `role="alert"`); foto placeholder; formulário de interesse (modal/inline atual) recebe estilo clay |
| A11y | coração com `accessibilityRole="button"` e label "Favoritar/Remover dos favoritos" + `selected` |
| Aceite | e2e `SearchToDetails.test.tsx` + suítes de detalhes passam sem alterar seletores |

### V07 — Favoritos

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 1, tela 07 |
| Rota | `(tabs)/favoritos.tsx` → `FavoritesScreen.tsx` (`favorites-screen`) |
| Papel | autenticado (guard atual) |
| Composição | título "Guardados no coração" + contador "Meus favoritos • N" (`favorites-title`) → lista `AnimalCard discovery` (`favorites-list`) com coração ativo |
| Interações | card → detalhes; coração → remove (mesmo `ToggleFavoriteUseCase`); empty state ilustrado (`empty-favorites`) |
| Aceite | `FavoritesScreen.test.tsx` |

### V08 — Conta · Visitante

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 1, tela 08 |
| Rota | `(tabs)/conta.tsx` → `AccountScreen.tsx` estado `account-visitor` |
| Papel | visitante |
| Composição | logo + ilustração (clay) → "Você está como visitante" → mensagem "Entre para favoritar, demonstrar interesse e anunciar." → 3 infos com ícone (Favoritar animais, Demonstrar interesse, Anunciar resgates — **texto alvo**: "Anunciar resgate" conforme terminologia do app; prancha exibe "Anunciar resgates" — prefere-se a terminologia atual, divergência menor registrada) → primary "Entrar" (`account-login`) → secondary "Criar conta" (`account-register`) |
| Tab bar | visitante vê só Início + Entrar (atual via `href: null`) — prancha igual |
| Aceite | `AccountProfile.test.tsx` |
| Pendências | ilustração do casal de pets = mesma pendência asset (3.2) — placeholder tipográfico até asset |

### V09 — Meus anúncios

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 2, tela 09 |
| Rota | `(tabs)/meus-anuncios.tsx` → `MyAnimalsScreen.tsx` (`my-animals-screen`) |
| Papel | autenticado |
| Composição | `SearchHeader` + título "Histórias que você cuida" + contador ("Meus anúncios • N") → primary "+ Novo anúncio" (`new-animal-button`) → lista `AnimalCard management`: foto, nome, badge status, `SavedOnDeviceBadge` quando há pendência, ações **Editar / Adotado / Excluir** |
| Interações | Editar → `(protected)/editar-anuncio?id=`; Adotado → `MarkAnimalAdoptedUseCase` (`:78`); Excluir → `DeleteAnimalUseCase` (`:62`) com confirmação (padrão atual) |
| Estados | loading (`my-animals-loading`), vazio (`empty-my-animals`), feedback (`my-animals-feedback`), item pendente de conflito: badge warn "Precisa de revisão" com navegação para V14 |
| A11y | ações com 48dp e label próprio |
| Aceite | `MyAnimalsScreen.test.tsx` |
| Nota | badge "Adotado" reflete `item.status.isAdopted()` (evid. `MyAnimalsScreen.tsx:136`); chip de status usa `success.base` com texto branco (6,36:1, seção 4.1) |

### V10 — Novo anúncio

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 2, tela 10 |
| Rota | `(protected)/novo-anuncio.tsx` → `AnimalFormScreen.tsx` `isEdit=false` |
| Papel | autenticado |
| Composição | header back + "Novo anúncio" → `HeroPhoto` placeholder câmera → par `ClayButton` compactos Câmera (`btn-capture-photo`) · Galeria (`btn-pick-gallery`) → form: Nome (`input-name`), Espécie chips (`radio-species-Cão/Gato`), Sexo (`radio-sex-Macho/Fêmea`), Porte (`input-size`), Idade (`input-age`), Bairro (`input-neighborhood`), Cidade (`input-city`), primary "Usar minha localização" (`btn-capture-location`) → nota "Somente bairro e cidade serão exibidos." → preview foto (`form-photo-preview`) + `photo-status` (inclui `SavedOnDeviceBadge`) → `location-status` → primary "Salvar anúncio" (`btn-submit-animal`) |
| Dados/interações | `CreateAnimalUseCase` (`:183`); câmera/galeria via `ImagePickerCameraAdapter`; localização via `ExpoLocationAdapter` (proximidade idem doc) |
| Estados | permissão negada → mensagem "Permissão da câmera não concedida" + recuperação: dá para seguir com Galeria; cancelamento volta ao form sem alterações (estado neutro); foto salva no aparelho quando offline → `photo-status` "Salvo no aparelho" |
| Aceite | `PhotoSaveFlow`, `HardwareFailure`, `MockCompletion.test.tsx` |
| A11y | campos com rótulo acima (prancha) e `accessibilityLabel` completo |

### V11 — Editar anúncio

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 2, tela 11 |
| Rota | `(protected)/editar-anuncio.tsx` → `AnimalFormScreen.tsx` `isEdit=true` (params id) |
| Diferenças p/ V10 | foto pré-preenchida, dados preenchidos, CTA "Salvar alterações"; nota de local vira "Localização aproximada"; **supersede da fila preservado** (ordem 3 — `enqueueAnimalUpdate`) |
| Interações | `UpdateAnimalUseCase` (`:126`); conflito → redireciona estado gerado pela fila (doc §9.4) |
| Aceite | suítes de update/supersede + form |

### V12 — Conta · Perfil (autenticado)

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 2, tela 12 |
| Rota | `(tabs)/conta.tsx` → `AccountScreen.tsx` `account-user` |
| Papel | autenticado (badge de papel real do usuário — `ROLE_LABELS`) |
| Composição | avatar (inicial ou foto) + nome + email + badge de papel (evid. `account-role` com `ROLE_LABELS`) → compactos Tirar foto (`avatar-camera`) · Galeria (`avatar-gallery`) · Remover (`avatar-remove`) → campos Nome (`profile-name`), Telefone (`profile-phone`), Sobre você (`profile-bio` + contador `profile-bio-counter`) → primary "Salvar alterações" (`profile-save`) → link "Sair" (`account-logout`) |
| Feedback | `profile-feedback` |
| **Pendência (V12)** | prancha exibe "Interesses de adoção" (chips). **Não existe no código.** UI-07 → **não adicionar sem decisão de produto**; registrado como pendência com impacto (novo dado de perfil + persistência + sync?) |
| Aceite | `AccountProfile.test.tsx` |

### V13 — Sincronização

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 2, tela 13 |
| Rota | `(tabs)/sync.tsx` → `SyncStatusScreen.tsx` (`sync-status-screen`) |
| Papel | autenticado |
| Composição | ilustração de nuvem (clay) → card "Salvo no aparelho — N alterações aguardando envio" → primary "Sincronizar agora" (`btn-trigger-sync`) → lista de pendências (`pending-actions-list`) com item tipo `foto/anúncio • Pendente` (`SavedOnDeviceBadge`) → banner resultado (`sync-result-banner`) → botão "Revisar" quando há conflito (`btn-open-conflicts`) → rodapé de capacidades offline (`offline-capabilities-section`) com nota "O envio continua quando a conexão voltar." |
| Realidade | item "Luna • Precisa de revisão" = **estados reais** (CONFLITO na fila, marcador RF23, doc §9.4); alerta amarelo com contagem e Revisar |
| Interações | sync → `ProcessSyncQueueUseCase` (`:55`) — **backoff/espaçamento da ordem 7 preservado**: resultado mostra sucesso/falha real; nunca "Enviado" sem confirmação (UI-09) |
| Aceite | `SyncUi.test.tsx` |
| A11y | lista com role list; cada item label completo (tipo, título, status) |

### V14 — Revisar alterações (conflitos)

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 2, tela 14 |
| Rota | `(protected)/conflitos.tsx` → `ConflictReviewScreen.tsx` (`conflict-review-screen`) |
| Papel | dono do item em conflito |
| Composição | back (`conflicts-back`) → título "Qual versão vamos manter?" + contexto ("X foi atualizada/alterado no servidor.") → comparativo **duas colunas Sua edição / Versão online** (campos divergentes destacados; doc §9.4: versões iguais são resolvidas pela mais recente, sem perguntar; apenas divergentes voltam para esta tela) → nota "Nenhuma alteração será descartada sem sua escolha." → primary "Manter minha edição" (+ atual botão equivalente) e secundário "Usar versão online" |
| Interações | resolve pelo fluxo atual `ResolveSyncConflictUseCase` (doc consolidado; ordem 3 preserva conflito) |
| Estados | loading (`conflicts-loading`), vazio (`conflicts-empty`), feedback (`conflicts-feedback`) |
| Adaptação | colunas empilham verticalmente (DECISÃO de adaptação; sem scroll horizontal) |
| Aceite | suítes de conflito + `Screens.test.tsx` |

### V15 — Moderação

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 2, tela 15 |
| Rota | `(tabs)/moderacao.tsx` → `ModerationScreen.tsx` (`moderation-screen`) |
| Papel | **administrador** (guard AccessPolicy MODERATION) |
| Composição | escudo clay + título "Moderação" + badge "Administrador" → lista `AnimalCard management` variante moderação: nome, espécie, badge Visível/Oculto (`visible`/`hidden`), botão Ocultar/Reexibir |
| Interações | `ModerateAnimalUseCase` (evid. `ModerationScreen.tsx:5` — import) |
| Estados | loading (`moderation-loading`), vazio (`moderation-empty`), feedback (`moderation-feedback`) |
| Privacidade | **nada muda** — moderação nunca expone contatos públicos (UI-08) |
| Aceite | `ModerationScreen.test.tsx` |
| Nota divergência | abas: prancha esconde "Favoritos" para admin; código mantém. **Funcionalidade atual preservada** (seção 2.2 item 1 + matriz §7) |

### V16 — Detalhes · Responsável

| Campo | Especificação |
| --- | --- |
| Referência | Prancha 2, tela 16 |
| Rota | `animal/[id].tsx` — estado de dono, exibido quando o usuário é o responsável pelo anúncio (evid. `mark-adopted-button`, `received-interests` — `AnimalDetailsScreen.tsx:238/245`) |
| Papel | responsável/dono do anúncio |
| Composição | como V06 **mas**: badge "Seu anúncio" (`StatusBadge owner`) em vez de coração → primary "Marcar como adotado" (`mark-adopted-button`) → seção "Interessados • N — Somente você vê estes contatos" (`received-interests` + `received-interests-empty`/`received-interests-error`) com cards de contato (nome + email — dados reais do `RegisterAdoptionInterestUseCase`) → secondary "Gerar PDF do anúncio" |
| Privacidade | interessados **nunca** no estado público (UI-08; guard atual preservado) |
| Interações | adotado → `MarkAnimalAdoptedUseCase` (`:137`) |
| Aceite | suíte de detalhes |

---

## 7. Navegação e matriz de visibilidade por papel (UI-08)

Evidência: `AccessPolicy.ts` (áreas/níveis) + Tabs com `canAccess` + `RequireAccess`.

| Tela/ação | Visitante | Autenticado | Dono (Responsável) | Admin |
| --- | --- | --- | --- | --- |
| V03/V04/V05 buscar, ver lista/mapa | ✓ | ✓ | ✓ | ✓ |
| V06 detalhes público + interesse | ver ✓ / agir → leva a V08 | ✓ | ✓ | ✓ |
| V07 favoritos | aba oculta; link direto → tela de acesso negado | ✓ | ✓ | ✓ |
| V09 meus anúncios | aba oculta | ✓ | ✓ | ✓ |
| V10/V11 criar/editar | bloqueado (RequireAccess) | ✓ | ✓ (próprio) | ✓ |
| V13 sync | aba oculta | ✓ | ✓ | ✓ |
| V14 revisar conflitos | bloqueado (RequireAccess) | ✓ | ✓ (item próprio) | ✓ |
| V15 moderação | off | ✗ | ✗ | ✓ |
| V16 interessados | ✗ | (se dono) ✓ | ✓ | ✓ |
| Ocultar/Reexibir | ✗ | ✗ | ✗ | ✓ |

Regras permanentes:
- A aba restrita **some para quem não tem acesso** (comportamento atual com
  `href: null`) — a rota continua protegida por `RequireAccess`.
- "Ocultar controle" **não substitui** autorização de backend (UI-08).
- Localização sempre aproximada — nota textual (`approx-location`) em V04/V06/V10/V11.

---

## 8. Estados de formulário, mídia, conexão e sincronização (UI-09)

### 8.1 Formulário (V02/V10/V11/V12)
| Estado | Gatilho | Aparência | Ação/saída |
| --- | --- | --- | --- |
| padrão | — | campos clay | — |
| focado | focus no campo | anel `line.focus` 2px | — |
| erro validação | submit inválido | banner feedback + campo com msg (texto, não só cor) | corrigir |
| erro servidor | falha do use case | banner mensagem de produto (sem UUID/stack) | tentar |
| sucesso | use case resolve | feedback verde breve (ou navegação — foto/form: navega) | — |
| enviando | submit | botão busy, resto disabled | cancelar onde já é possível hoje |

### 8.2 Mídia (foto)
| Estado | Mensagem de produto | ação |
| --- | --- | --- |
| placeholder sem foto | "Adicione uma foto do animal" | Câmera/Galeria |
| carregando em card | fundo `bg.recessed` + iniciais | — |
| falha de foto | iniciais sobre fundo (sem texto técnico) | reabrir |
| permissão negada | "Permissão da câmera não concedida" | seguir via Galeria |
| cópia falha no aparelho (ordem 5 — `PhotoCopyError`) | "Não conseguimos salvar a foto no aparelho. Tente de novo ou escolha outra imagem." | tentar novamente ou re-escolher — **nunca registra URI temporária** (comportamento novo já implementado) |
| cancelamento | volta ao form sem mudança | — |

### 8.3 Conexão e sincronização
| Estado | Onde | SINAL |
| --- | --- | --- |
| offline | `connection-banner` (V03) | "Modo Offline — Exibindo anúncios em cache" (texto atual) |
| salvo no aparelho | `SavedOnDeviceBadge` (V09–V13) | "Salvo no aparelho" (persistido localmente, sync pendente) |
| aguardando envio | mesmo | "3 alterações aguardando envio" (V13) |
| sincronizando | V13 lista | "Enviando…" enquanto fila ativa |
| sincronizado | V03 check | "Dados atualizados · hh:mm" **somente após pull concluído** (evento ordem 4) |
| backoff | V13 | item com espera — mostra "Tentando novamente em breve" (ordem 7) |
| falha | V13 | ícone + texto do erro traduzido |
| em conflito | V13 badge warn + V14 | "Precisa de revisão" → Revisar |

Proibido (UI-09): mostrar "publicado/sincronizado" antes da confirmação;
UUIDs/erros internos em mensagens de produto.

---

## 9. Adaptação, acessibilidade e desempenho (UI-11/UI-13)

- **Áreas seguras:** `SafeAreaView`/insets em header e tab bar (evid. `react-native-safe-area-context` já na dependência).
- **Teclado:** `KeyboardAvoidingView` + `ScrollView`; nenhum CTA fica atrás do
  teclado; sheet de filtros fecha sem perder estado.
- **Fonte ampliada:** alturas de controles fixadas (52dp) e `allowFontScaling`
  padrão; rótulos não dependem de altura de linha do título.
- **Textos longos:** `numberOfLines` somente em cards (com o título completo no detalhe).
- **Toque:** 48dp (chips complementados com `hitSlop 8`).
- **Sem-dependência-de-cor:** estados sempre com texto/ícone (badges, chips com check).
- **Contraste pares reais calculados** (seção 4.1): todos os pares texto/fundo
  implementados ≥ 4,5:1; exceção única `accent.base` restrita a ícones/large.
- **Redução de movimento:** animações decorativas (ilustrações estáticas; press
  scale respeita preferência do sistema — validar em device; pendência).
- **Desempenho (UI-13) — orçamento numérico DECISÃO:**
  - Cenário alvo: lista de ~50 anúncios com foto 4:3 ~1280px lado maior em
    `thumbnail` (manipulator já usado no pipeline), scroll 60fps.
  - FlatList com `windowSize 7`, `maxToRenderPerBatch 6`; uploads continuam
    backgrounded (ordem 2/8 fora de escopo visual).
  - **Plano de validação:** medir no aparelho físico (ordem 8) — scroll
    contínuo 60s, registrar jank/fps via dev tools; **resultado pendente até lá
    — NÃO declarar desempenho adequado sem medição**.

---

## 10. Plano incremental de implementação (com dependências e arquivos)

**Princípio de preservação (UI-07/UI-12):** a cada fase, suíte 428 NÃO pode
regredir; nenhum `testID` apagado sem atualização consciente do teste
(correspondente documentada). Commits por fase (padrão já usado: TDD + suíte +
typecheck + commit por fase).

| Fase | Conteúdo | Arquivos afetados | Riscos |
| --- | --- | --- | --- |
| **F0 — Fundação visual** | `theme.ts` (valores dos tokens), `typography.ts`, `EnlaceLogo` (fallback text), `ClayButton/ClayField/Chip/StatusBadge/EmptyState` | `src/adapters/ui/*` (novo) | nenhum comportamental |
| **F1 — Shell** | `TabBarClay` + header, tabs 5-slot p/ admin com acesso integral mantido | `app/(tabs)/_layout.tsx` | alterar contraste/icons — testes de rota |
| **F2 — Auth** | V01, V02 (SecureField, olho) | `LoginScreen.tsx`, `RegisterScreen.tsx` | tests AuthScreens (seletores iguais) |
| **F3 — Explorar** | V03/V04/V05 (`FilterSheet` novo; busca re-hook `onPullCompleted` preservada) | `SearchScreen.tsx`, `AnimalMap.tsx`, novo `FilterSheet` | e2e + todos testIDs de busca |
| **F4 — Detalhes** | V06/V16 (chips ícone, interessados clay, PDF) | `AnimalDetailsScreen.tsx` | e2e SearchToDetails |
| **F5 — Favoritos/Conta** | V07, V08, V12 | `FavoritesScreen.tsx`, `AccountScreen.tsx` | AccountProfile |
| **F6 — Meus anúncios** | V09 (`AnimalCard management` + badge) | `MyAnimalsScreen.tsx` | MyAnimalsScreen.test |
| **F7 — Formulários** | V10/V11 (clay form + badges offline) | `AnimalFormScreen.tsx` | PhotoSaveFlow/HardwareFailure |
| **F8 — Sync/Conflitos** | V13/V14 | `SyncStatusScreen.tsx`, `ConflictReviewScreen.tsx` | SyncUi |
| **F9 — Moderação** | V15 | `ModerationScreen.tsx` | ModerationScreen.test |
| **F10 — Sweep final** | consistência de tokens, contrastes, screenshots por tela | docs + fixes | — |

**Dependências externas (PENDÊNCIAS que travam fases):**
- Asset `logo-enlace.png` → F0/F1/F2/F3 (atraso até entrega; fallback textual no ínterim).
- Fontes `.ttf` (Arial Black/equivalente) → tipografia final (F0 tokens já abstraem).
- Nenhuma nova dependência de biblioteca; ícones via Ionicons existente.

---

## 11. Plano de validação (visual e funcional)

### 11.1 Funcional (a cada fase — obrigatório antes do commit)
- `npm test` (suíte baseline 428 — sem regressões; novos testes de estilo
  podem somar), `npm run typecheck`.
- Fluxos e2e checados por fase conforme tabela acima (evid. por suíte).

### 11.2 Visual (comparação contra pranchas — UI-14)
- Verificação tela a tela (V01–V16) em emulador: composição,
  hierarquia, tipografia, cores, espaçamento, dimensões, logo, fotos, estados
  vazio/ofline/erro. **Quando:** device real (ordem 8) + Expo em emulador no ambiente de dev.
- Registro: tabela de diferenças intencionais (com justificativa) por tela.
- **NÃO declarado:** parecer de fidelidade baseado só em typecheck/suíte
  (explícito proibido pela UI-14).

### 11.3 Acessibilidade
- Auditoria por tela: nomes acessíveis, ordem leitura (leitores de tela),
  contraste pares efetivos, 48dp. Manual em device (pendência de ambiente),
  automatizado onde possível (`accessibilityProps` nos testes).

### 11.4 Desempenho
- Apenas **após** device físico (ordem 8): medições registradas na seção 9.

---

## 12. Registro de decisões, divergências e correções

### 12.1 Correções aplicadas a `instrucoes_iniciais.md` (autorizadas pelo usuário em 06/11/2026)

As correções abaixo foram constatadas na revisão obrigatória (instruções §3),
aplicadas **no guia e no próprio `instrucoes_iniciais.md`** (com nota de
inspeção datada em cada regra e seção "Revisão registrada" ao final), com a
fonte local que as fundamenta:

| # | Divergência no arquivo | Correção aplicada | Fonte local |
| --- | --- | --- | --- |
| 1 | Deliverable `docs/ui/UI_IMPLEMENTATION_GUIDE.md` | Usuário fixou `docs/ui/docs/refatoracao_ui.md` | instrução explícita do usuário (06/11/2026) |
| 2 | Vocab: caminhos das pranchas assumidos existentes | Confirmados: `docs/ui/images/Painel Enlace com logos de pets-2.png` (prancha 1/V01–V08) e `docs/ui/images/Reparo do emblema Enlace em telas móveis-1.png` (prancha 2/V09–V16); números das pranchas invertiam a ordem numérica no nome do arquivo (a "1" contém 02/02 e a "2" contém 01/02) — registrados por conteúdo | UI-01 + glob |
| 3 | UI-03 assume fontes "Arial Black/DejaVu Sans" carregáveis | Não há arquivos de fonte nem assets; fallback + pendência explícita | `package.json` + glob `assets/**` |
| 4 | UI-02 parte de logo asset presente | Asset inexistente; dependência registrada + fallback textual | glob assets |
| 5 | UI-06 "12 rotas" | **16 arquivos em `app/`: 13 rotas (12 telas + 1 redirect raiz `app/index.tsx` → `/(tabs)`) + 3 layouts (`_layout` raiz, `(tabs)/_layout`, `(protected)/_layout`)** — contagem com evidência por arquivo | glob `app/**/*.tsx` |
| 6 | UI-06: fluxos de câmera como telas próprias | Confirmado: são gatilhos `ImagePicker` (ImagePickerCameraAdapter) — spec seguiu isto | `src/infrastructure/device/camera/ImagePickerCameraAdapter.ts` (uso em `AnimalFormScreen.tsx`, `AccountScreen.tsx`) |
| 7 | UI-13 orçamento não numérico | Cenário + volume + métrica definidos como DECISÃO (seção 9), execução pendente de device | instruções UI-13 (requer números: fornecidos) |
| 8 | Papéis: instruções têm "Responsável/Interessado" como ações | Matriz usando `AccessPolicy` real (VISITOR/USER/ADMIN + especializações internas) | `AccessPolicy.ts` |

### 12.2 Decisões de implementação registradas (não extraídas da imagem)

Consolidadas ao longo do texto com o rótulo DECISÃO: paleta derivada (`warn`,
`error`, `border`, `overlay`), escala/ráios/sombras clay concretas, 5-abas com
admin mantendo acesso integral, olho de senha, `FilterSheet`, indicador "Dados
atualizados" via `pullEvents`, fallback textual da logo, tipografia fallback
sistema→asset futuro, colunas de conflito empilhadas, orçamento de desempenho.

### 12.3 Pendências globais (impacto concreto)

| Pendência | Impacto | Resolução |
| --- | --- | --- |
| Asset logo canônico | F0–F3 sem emblema real (fallback textual) | fornecer arquivo; conferir contorno contínuo (UI-02) |
| Fontes (.ttf) | tipografia usa fallback sistema | fornecer Arial Black + texto; carregamento único expo-font |
| "Interesses de adoção" no perfil (V12) | seção não implementada sem decisão | decisão de produto (novo dado/sync?) |
| Campo "descrição/summary" (V06) | texto atual vém de `summary()` — prancha sugere texto livre | decisão de produto (schema + sync) |
| Liberação de device/env (ordem 8) | sombras clay Android, mapa real, contraste em tela, desempenho | ambiente real |
| Moderação tab replace Favoritos (prancha 15) | acesso a Favoritos por admin se mantiver a prancha tal qual | decisão de produto (recomendação: manter acesso — atual já seguro) |

### 12.4 Critério de conclusão (checklist do instruções §7)

- [x] Instruções comparadas com docs principais; divergências corrigidas com fonte (12.1)
- [x] Referências visuais única e exclusivamente as duas pranchas
- [x] Todos os assets disponíveis identificados (3.1)
- [x] Rotas/variantes mapeadas com evidência (seção 2)
- [x] Logo/fontes: dependência concreta registrada (3.2/3.3)
- [x] Tokens com valores/unidades; estimativas rotuladas DECISÃO (4)
- [x] Componentes com variantes/estados/contratos (5)
- [x] 16 telas nos campos do modelo (6)
- [x] Papéis/offline/preservação funcionais considerados (7/8)
- [x] Plano incremental + validação com critérios (10/11)
- [x] Nenhuma execução de teste/implementação declarada sem ter ocorrido
- [x] Pendências bloqueadoras explícitas (12.3)

**Regra final seguida:** nenhuma medida ausente foi inventada silenciosamente —
tudo ausente virou DECISÃO identificada ou PENDÊNCIA com impacto.
