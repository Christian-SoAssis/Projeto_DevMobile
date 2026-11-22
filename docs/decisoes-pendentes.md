# Decisões de Produto e Arquitetura — Enlace

Este documento consolida todas as decisões de produto e arquitetura do aplicativo **Enlace**, conforme levantado na documentação principal (`docs/documentacao-software-rede-adocao-animais.md`, seções 18 e 19) e nos demais arquivos de `docs/`.

---

## 1. Decisões pendentes

Nenhuma decisão pendente no momento — todos os 9 itens anteriormente abertos na seção 19 (`D1` a `D9`) foram decididos em **22/11/2026** e movidos para a seção 2 abaixo.

---

## 2. Decisões já tomadas (registradas na seção 18 do documento principal)

| # | Decisão | Valor adotado | Justificativa / Fonte |
|---|---------|---------------|-----------------------|
| D1 | **Método exato de autenticação no Supabase** | **E-mail e senha** via Supabase Auth nativo (`signInWithPassword` / `signUp`), sem confirmação de e-mail obrigatória no MVP | Permite fluxo imediato de cadastro/login em testes e uso comunitário mantendo sessão JWT real para RLS (§18 item 23 / §19) |
| D2 | **Campos obrigatórios e limites de tamanho** | **Obrigatórios no anúncio:** Nome (`2–60` chars), Espécie, Porte, Sexo, Idade aproximada (`1–30` chars), Bairro (`2–60` chars), Cidade (`2–60` chars) e `1 a 4` fotos WebP. **Opcionais no anúncio:** Características, Comportamento e Cuidados especiais (máx. `500` chars cada). **Interesse:** Mensagem obrigatória (`10–400` chars) e telefone/contato | Garante consistência no domínio, SQLite e Supabase e evita textos vazios ou excessivos (§18 item 24 / §19) |
| D3 | **Regras de exclusão de anúncio já adotado** | **Permitida pelo responsável** mediante diálogo de confirmação (`Alert.alert`), gerando *tombstone* `DELETED` na sincronização | Permite ao tutor remover o anúncio a qualquer momento e limpa o cache local de outros dispositivos no delta sync (§18 item 25 / §19) |
| D4 | **Possibilidade de reabrir animal de "Adotado" para "Disponível"** | **Sim, permitido ao responsável** mediante diálogo de confirmação (`Alert.alert`), com suporte offline-first na `sync_queue` | Permite corrigir marcação acidental ou reabrir a adoção caso a entrega não se concretize (§18 item 26 / §19) |
| D5 | **Escopo de moderação administrativa** | Restrito a **Ocultar (`HIDE`) e Reexibir (`UNHIDE`)** anúncios (`moderation_status` = `'HIDDEN'` ou `'NONE'`) | Mantém rastreabilidade/auditoria sem perda destrutiva de dados e propaga ocultação via *tombstone* `HIDDEN` (§18 item 27 / UC20) |
| D6 | **Visibilidade dos dados de contato (Privacidade progressiva)** | **Público/Visitante:** vê apenas nome do pet, localização aproximada (Bairro, Cidade, UF) e dados do anúncio. **Responsável:** vê nome e telefone/e-mail dos interessados no próprio anúncio. **Interessado:** acompanha a trilha e é informado da liberação do contato direto quando o status avança para `EM_ANALISE` ou `VISITA_COMBINADA` | Protege a privacidade do responsável contra exposição pública de telefone e endereço (RNF04, RNF05, §18 item 28) |
| D7 | **Política de retenção de manifestações de interesse** | **Histórico mantido enquanto o anúncio existir** (`ON DELETE CASCADE` ao excluir o anúncio) + **opção de o próprio interessado cancelar/retirar sua manifestação** a qualquer momento | Preserva o histórico de acompanhamento para tutor e adotante sem reter dados órfãos após exclusão do anúncio (§18 item 29 / §19) |
| D8 | **Precisão para arredondar/anonimizar coordenadas GPS** | **3 casas decimais** (`Math.round(coord * 1000) / 1000`, precisão aproximada de `~110 m`) e exibição textual restrita a **Bairro, Cidade e UF** (nunca rua ou número) | Equilibra precisão de raio de busca (até 10 km) e mapa aproximado com anonimização da residência do tutor (RNF05, §18 item 30) |
| D9 | **Suporte offline completo para mutações de favoritos e interesses** | **Suporte offline-first completo na `sync_queue`** para Favoritos (`CREATE`/`DELETE`) e Interesses (`CREATE` pelo interessado, `UPDATE` de etapa pelo responsável e `DELETE`/cancelamento pelo interessado) | Garante experiência offline-first consistente em todas as interações do usuário (§18 item 31 / OFF-01) |
| D13 | Limite de fotos por anúncio | 4 (`MAX_PHOTOS_PER_ANIMAL`) | §18 item 13 |
| D14 | Raio máximo de pesquisa | 10 km (`SearchRadius`) | §18 item 14 |
| D15 | Política de conflito simples vs revisão | *Last-write wins* + revisão manual para divergência de status (`AVAILABLE` vs `ADOPTED`) | §18 item 15 |
| D16 | Etapas da trilha de interesse | `ENVIADA` → `EM_ANALISE` → `VISITA_COMBINADA` → `CONCLUIDA` (+ `RECUSADA` fora da trilha) | §18 item 18 |
| D19 | Onde o responsável gerencia interesses recebidos | Nos detalhes do anúncio, seção/botão "Interessados • N" | §18 item 19 |
| D20 | Persistência do contador de não-vistas | Tabela local `app_state` (chave/valor) | §18 item 20 |
| — | Carrossel + visualizador com zoom nas fotos | ≥ 2 fotos = carrossel; 1 foto = simples; tela cheia com zoom 1x–4x | §18 item 16 |
| — | Características no formulário | Opcionais (espécie, porte, idade, sexo continuam obrigatórios) | §18 item 17 |
| — | Estratégia de sync | Delta sync com cursor `(updated_at, id)`, sobreposição 60s, paginação 100 | §18 / OFF-06 |
| D21 | Mecânica de atualização de páginas (Pull-to-Refresh) | Gesto nativo de deslizar para baixo com `RefreshControl` nas listas (`index`, `meus-anuncios`, `favoritos`, `notificacoes`, `sync`) acionando `useFullSync` quando online e recarga local do SQLite | §18 item 21 / OFF-09 |
| D22 | Fluxo de confirmação de adoção e auto-adoção ao concluir interesse | (1) Atualizar status de interesse exige `Alert.alert` de confirmação com nome do interessado, nome do pet e etapa destino; (2) Ao confirmar "Concluída", o animal é automaticamente marcado como adotado (atômico, offline-first); (3) Marcar como adotado ou reabrir também exige `Alert.alert` de confirmação com o nome do pet | §18 item 22 / RF12 / D16 |

---

## 3. Itens fora de escopo (confirmados como Não Aplicável)

| # | Recurso | Decisão | Fonte |
|---|---------|---------|-------|
| NA1 | Vídeo | Não está no escopo do Enlace | docs/arquitetura/03 (CAP-05, CAP-06, MID-06) |
| NA2 | QR Code / códigos de barras | Não está no escopo do Enlace | docs/arquitetura/03 (CAP-07, CAP-08) |
| NA3 | Exportação para galeria do usuário / álbuns | Não está no escopo | docs/arquitetura/04 (MID-04) |
| NA4 | Reconhecimento de imagem / IA | Não está no escopo | docs/arquitetura/04 (MID-08) |
| NA5 | Câmera própria (CameraView montada na tela) | Usa expo-image-picker (seletor nativo) | docs/arquitetura/03 (CAP-01 a CAP-04) |

---

## 4. Como usar este documento

- Antes de implementar qualquer novo fluxo, conferir as decisões consolidadas na seção 2.
- Quando uma nova decisão for tomada, adicioná-la à seção 2 e à seção 18 de `docs/documentacao-software-rede-adocao-animais.md`.
