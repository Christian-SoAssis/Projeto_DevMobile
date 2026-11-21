# Decisões pendentes — Enlace

Este documento reúne tudo que ainda precisa ser decidido pela equipe de produto antes de ser implementado,
conforme levantado na documentação (`docs/documentacao-software-rede-adocao-animais.md`, seção 19) e nos demais
arquivos de `docs/`.

Cada item inclui: a decisão necessária, onde foi registrado, o impacto se não for tomada e o status sugerido.

---

## 1. Decisões registradas na documentação principal (seção 19 — "Pontos ainda não definidos")

| # | Decisão necessária | Fonte | Impacto se não decidido | Status |
|---|-------------------|-------|-------------------------|--------|
| D1 | **Método exato de autenticação no Supabase** (e-mail/senha, magic link, OAuth, etc.) | §19 | Não é possível finalizar o fluxo de login/cadastro nem definir políticas de sessão | Pendente |
| D2 | **Campos obrigatórios e limites de tamanho** de cada formulário | §19 | Validação no domínio e na UI fica incompleta; risco de dados inválidos no banco | Pendente |
| D3 | **Regras de exclusão de anúncio já adotado** | §19 | Não se sabe se um animal "Adotado" pode ser excluído ou só ocultado | Pendente |
| D4 | **Possibilidade de reabrir um animal de "Adotado" para "Disponível"** | §19 | O estado de adoção fica irreversível; não há fluxo de correção de erro | Pendente |
| D5 | **Tipo de ação de moderação administrativa** além do mínimo (HIDE/UNHIDE, remover, suspender) | §19 / UC20 | A moderação do administrador não tem escopo definido | Pendente |
| D6 | **Visibilidade exata dos dados de contato** do responsável | §19 | Não se sabe qual informação de contato é exposta ao público vs. só ao interessado | Pendente |
| D7 | **Política de retenção de manifestações de interesse** | §19 | Não se sabe por quanto tempo manter registros de interesse no banco | Pendente |
| D8 | **Precisão exata para arredondar/anonimizar coordenadas** | §19 | Risco de vazar localização exata do tutor; a aproximação fica subjetiva | Pendente |
| D9 | **Quais mutações de favoritos/interesses terão suporte offline completo** | §19 | Fila de sync pode ficar incompleta para algumas entidades | Pendente |

---

## 2. Decisões já tomadas (registradas na seção 18 do documento principal)

Incluídas aqui para referência — não precisam ser decididas novamente:

| # | Decisão | Valor adotado | Fonte |
|---|---------|---------------|-------|
| D13 | Limite de fotos por anúncio | 4 (MAX_PHOTOS_PER_ANIMAL) | §18 item 13 |
| D14 | Raio máximo de pesquisa | 10 km (SearchRadius) | §18 item 14 |
| D15 | Política de conflito simples vs revisão | last-write wins + revisão para divergência de status | §18 item 15 |
| D16 | Etapas da trilha de interesse | ENVIADA → EM ANÁLISE → VISITA COMBINADA → CONCLUÍDA (+ RECUSADA fora da trilha) | §18 item 18 |
| D19 | Onde o responsável gerencia interesses recebidos | Nos detalhes do anúncio, botão "N interesses" | §18 item 19 |
| D20 | Persistência do contador de não-vistas | Tabela local `app_state` (chave/valor) | §18 item 20 |
| — | Carrossel + visualizador com zoom nas fotos | ≥ 2 fotos = carrossel; 1 foto = simples; tela cheia com zoom 1x–4x | §18 item 16 |
| — | Características no formulário | Opcionais (espécie, porte, idade, sexo continuam obrigatórios) | §18 item 17 |
| — | Estratégia de sync | Delta sync com cursor (updated_at, id), sobreposição 60s, paginação 100 | §18 / OFF-06 |
| D21 | Mecânica de atualização de páginas (Pull-to-Refresh) | Gesto nativo de deslizar para baixo com `RefreshControl` nas listas (`index`, `meus-anuncios`, `favoritos`, `notificacoes`, `sync`) acionando `useFullSync` quando online e recarga local do SQLite | §18 item 21 / OFF-09 |
| D22 | Fluxo de confirmação de adoção e auto-adoção ao concluir interesse | (1) Atualizar status de interesse exige `Alert.alert` de confirmação com nome do interessado, nome do pet e etapa destino; (2) Ao confirmar "Concluída", o animal é automaticamente marcado como adotado (atômico, offline-first); (3) Marcar como adotado diretamente (via tela de detalhes ou Meus Anúncios) também exige `Alert.alert` de confirmação com o nome do pet | §18 item 22 / RF12 / D16 |

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

- Antes de implementar qualquer novo fluxo, conferir se há decisão pendente relacionada.
- Quando uma decisão for tomada, mover o item para a seção 2 (ou adicionar nova linha) e registrar a justificativa.
- Não inventar valores para itens pendentes sem decisão de produto.
