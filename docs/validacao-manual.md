# Validação manual — Enlace

Este documento lista tudo que precisa ser validado manualmente com Expo Go (ou dispositivo físico) e/ou servidor Supabase real.
Itens marcados como NV (Não verificado) na auditoria de arquitetura (docs/arquitetura/06-checklist-de-revisao.md) estão aqui.

Não testáveis apenas com testes unitários (Jest), pois exigem rede real, dispositivo físico ou servidor remoto.

---

## 1. Validação no servidor Supabase real (DAT-05 a DAT-12, OFF-06 a OFF-09)

Requer: acesso a um projeto Supabase (URL e anon key configurados em .env.local) e duas contas de teste (A e B).

| # | Cenário | O que validar | Regras relacionadas |
|---|---------|---------------|---------------------|
| V1 | RLS — leitura pública | Usuário não autenticado consegue listar animais com hidden = false | DAT-05, RNF04 |
| V2 | RLS — escrita pública bloqueada | Usuário não autenticado NÃO consegue inserir/atualizar/deletar animais | DAT-05 |
| V3 | RLS — edição por terceiro bloqueada | Conta A não consegue editar animal da conta B | DAT-05, RF10 |
| V4 | RLS — exclusão por terceiro bloqueada | Conta A não consegue excluir animal da conta B | DAT-05, RF11 |
| V5 | RLS — favoritos privados | Conta A não vê favoritos da conta B | DAT-05, RF14 |
| V6 | RLS — interesses privados | Conta A não vê interesses da conta B; só vê os próprios e os de seus anúncios | DAT-05, RF16 |
| V7 | Storage — usuário A não acessa arquivo de B | Tentar acessar URL de foto de outra conta via Storage | DAT-06 |
| V8 | Storage — bucket animal-photos protegido | Leitura pública funciona; escrita só pelo dono | DAT-06 |
| V9 | URL expirada renovada | URL assinada expira e é renovada pelo fluxo autorizado; offline mostra cópia local ou indisponibilidade | DAT-07, MID-05 |
| V10 | Reenvio idempotente (sem duplicação) | Reenviar mesma foto após timeout não cria arquivos/linhas duplicados | DAT-08, OFF-05 |
| V11 | Sucesso parcial retomado | Upload concluído mas insert de metadados falhou → retomar sem duplicar | DAT-09 |
| V12 | Tombstones — exclusão não ressuscita | Excluir animal em A; sincronizar em B; animal não reaparece | DAT-12, OFF-08 |
| V13 | Tombstones — ocultação (HIDDEN) propagada | Moderador oculta anúncio; outros aparelhos recebem a ocultação via tombstone | DAT-12, OFF-08 |
| V14 | Delta sync — cursor não avança em lote incompleto | Falhar ao aplicar item de um lote de pull; cursor não pula o lote | OFF-06 |
| V15 | Delta sync — relógio do aparelho atrasado | Sobreposição de 60s tolera pequenas diferenças de transação | OFF-06 |
| V16 | Conflito em dois aparelhos | Editar mesmo anúncio em dois dispositivos; política last-write wins ou revisão manual observada | OFF-07 |
| V17 | Edição durante envio | Confirmar revisão antiga não elimina pendência da nova revisão | OFF-07 |
| V18 | Worker não trava após falha | Falha no sync não bloqueia novas tentativas; trava é liberada | OFF-09, DAT-11 |
| V19 | Reconexão + botão manual simultâneo | Não duplicar processamento | OFF-09 |

---

## 2. Validação em dispositivo físico / Expo Go (PER-01 a PER-07, MID-01 a MID-09, DAT-03, DAT-10)

Requer: Expo Go instalado em dispositivo físico (ou emulator) e builds nativos.

| # | Cenário | O que validar | Regras relacionadas |
|---|---------|---------------|---------------------|
| V20 | Instalação nova + câmera | Primeira tentativa de captura funciona; não quebra o app | PER-01 |
| V21 | Negação permanente de câmera | Usuário nega câmera; app oferece alternativa de galeria; não há loop de solicitações | PER-01, PER-02 |
| V22 | Retorno das configurações do app | Após negar permanentemente, usuário vai às configurações, concede permissão e volta; fluxo reflete novo estado | PER-02 |
| V23 | Cancelamento do seletor de mídia | Cancelar preserva foto anterior; não cria registro vazio nem operação pendente | PER-05 |
| V24 | Seleção múltipla no limite | Selecionar várias mídias, atingir limite de 4 fotos, tentar tipo não aceito — não corrompe lista | PER-06 |
| V25 | URI temporária vs persistente | Salvar, encerrar app, reabrir — referência ao arquivo continua válida após limpeza de cache | PER-07, MID-02 |
| V26 | Compressão real medida | Comparar tamanho antes/depois da conversão WebP; qualidade visual com amostras reais | MID-01 |
| V27 | Falha de cópia de foto | Interromper app durante cópia para diretório persistente; falha não gera falsa confirmação | MID-02, MID-09 |
| V28 | URL expirada na lista | Foto com URL expirada mostra estado alternativo; offline usa cópia local | MID-05 |
| V29 | EXIF vs localização pública | Inspecionar EXIF do arquivo enviado; GPS preciso não vaza por acidente | MID-07, OFF-11 |
| V30 | Sessão expirada durante sync | Expirar sessão no meio de sync; após reautenticação, trabalho é enviado com conta correta | DAT-03, DAT-11 |
| V31 | Troca de conta A → B → A | Como A, criar rascunho offline; trocar para B; B não vê nem envia pendência de A; voltar para A preserva dados | DAT-10 |
| V32 | Localização pontual | Captura de localização apenas na criação de anúncio; não há rastreamento contínuo em segundo plano | OFF-11, RNF06 |
| V33 | Estado de sync na UI | Ausência de rede, falha permanente, nova tentativa — mensagens coerentes; "publicado" não é mostrado quando existe apenas rascunho local | OFF-10 |
| V34 | Gesto Pull-to-Refresh (deslizar para atualizar) | Deslizar para baixo no topo das listas (Feed, Meus Anúncios, Favoritos, Notificações, Sincronização). Online: exibe spinner terracotta, dispara `useFullSync` com Supabase e atualiza interface com o SQLite local; Offline: recarrega dados locais imediatamente sem travar a interface | OFF-09, OFF-10, RF17 |

---

## 3. Cenários de validação (T01–T28 do checklist)

Extraídos da seção 8 do docs/arquitetura/06-checklist-de-revisao.md. Podem ser executados com Expo Go + servidor Supabase real.

| # | Procedimento | Resultado esperado | Regras |
|---|-------------|-------------------|--------|
| T01 | Sem internet, criar/editar anúncio; fechar e reabrir | Dados e fotos reaparecem; estado remoto continua pendente | OFF-01, OFF-10, MID-02 |
| T02 | Salvar em versão antiga; atualizar com migration | Dados preservados; schema atualizado; pendências processáveis | OFF-02, DAT-01 |
| T03 | Interromper gravação antes da confirmação da transação | Não existe dado sem pendência, nem pendência inválida | OFF-04 |
| T04 | Servidor aceita mutação; resposta ao cliente perdida; reenviar | Um único resultado lógico; retry reconhece operação | OFF-03, OFF-05, DAT-08 |
| T05 | Falha ao aplicar item de lote de pull; reiniciar | Cursor não pula lote incompleto; repetição mantém consistência | OFF-06 |
| T06 | Editar mesmo anúncio em dois aparelhos e sincronizar | Política de conflito observável; sem descarte silencioso | OFF-07 |
| T07 | Alterar descrição/foto enquanto revisão anterior está sendo enviada | Confirmar revisão antiga não elimina pendência da nova | OFF-07, DAT-09 |
| T08 | Excluir em A; manter B offline; depois sincronizar | Item não reaparece; tombstone segue política de retenção | OFF-08, DAT-12 |
| T09 | Reconexão + sincronização manual juntas; falha no worker | Sem processamento duplicado; trava liberada | OFF-09, DAT-11 |
| T10 | Negar câmera; negar permanentemente; conceder nas configurações; voltar | Mensagens corretas; formulário preservado; permissão reavaliada | PER-01, PER-02, PER-03 |
| T11 | Cancelar seletor; asset inválido; selecionar múltiplos no limite | Nenhum registro vazio; mídia anterior preservada; limite respeitado | PER-05, PER-06 |
| T12 | Abrir câmera; navegar para outra tela; background; retornar; tocar rapidamente | Câmera acompanha ciclo de vida; uma captura por vez; falhas não travam UI | CAP-01 a CAP-03 |
| T13 | Capturar; refazer; aceitar; cancelar em sequências diferentes | Apenas mídias confirmadas persistem; associação correta ao anúncio | CAP-04, PER-07 |
| T14 | Fotos com orientações/dimensões/formatos diferentes | Saída visual correta; tamanho medido; MIME compatível | MID-01, DAT-08 |
| T15 | Após salvar, remover cache temporário; simular falta de espaço/cópia interrompida | Arquivos persistentes válidos; falhas não geram falsa confirmação | MID-02, MID-03, MID-09 |
| T16 | Confirmar upload; falhar ao gravar metadados; tentar novamente | Reutiliza/reconcilia arquivo remoto; conclui associação sem duplicar | DAT-08, DAT-09 |
| T17 | Expirar sessão durante sync; repetir após autenticação válida | Trabalho preservado e enviado com conta correta | DAT-03, DAT-11 |
| T18 | Como A, ler/alterar dados privados de B; usuário não autenticado | Acesso negado onde privado; leitura pública conforme política; escrita protegida | DAT-05, DAT-06 |
| T19 | Como A, criar pendência offline; trocar para B; voltar para A | B não vê nem envia pendência de A; dados seguem política de preservação | DAT-10 |
| T20 | Expirar URL assinada; abrir foto online e offline | Renovação autorizada online; cópia local/estado indisponível offline | DAT-07, MID-05 |
| T21 | Remover foto com falha no banco ou Storage; nova tentativa/limpeza | Remoção converge sem afetar outros arquivos; não sobram pendências invisíveis | DAT-12, MID-09 |
| T22 | Inspecionar EXIF do arquivo final; comparar com localização pública | Só dados pretendidos expostos; GPS preciso não vaza | MID-07, OFF-11 |
| T23 | (Se houver vídeo) Negar áudio; alcançar limite; interromper upload | Estado recuperável; sem gravação oculta | CAP-05, CAP-06, MID-06 — NA (vídeo fora de escopo) |
| T24 | (Se houver QR) Código na câmera; conteúdo inválido | Uma ação por leitura; conteúdo inválido não executa ação arbitrária | CAP-07, CAP-08 — NA (QR fora de escopo) |
| T25 | (Se houver galeria/álbum) Negar acesso; testar no build de destino | Erro compreensível; funcionamento dentro das permissões | MID-04 — NA (fora de escopo) |
| T26 | (Se houver IA) Análise com arquivo próprio e de outra conta; timeout | Autorização aplicada; segredo ausente no cliente; falha não destrói dados | MID-08, DAT-04 — NA (IA fora de escopo) |
| T27 | Gravar título com apóstrofo; entrada semelhante a SQL | Conteúdo tratado como dado; não altera comandos nem outras linhas | DAT-02 |
| T28 | Sincronizar alteração remota com lista aberta | UI reflete alteração pelo banco local; sem estado contraditório | OFF-02, OFF-10 |

---

## 4. Prioridade sugerida para execução

1. **P0 — Segurança:** V1 a V8 (RLS e Storage) — validar antes de qualquer release.
2. **P1 — Integridade de dados:** V9 a V14, T01 a T08 (sync, tombstones, delta).
3. **P2 — UX e dispositivo:** V15 a V33, T09 a T28 (permissões, mídia, estados de UI).
4. **P3 — Cenários NA:** T23 a T26 são Não Aplicáveis (vídeo, QR, galeria, IA fora de escopo).

---

## 5. Como registrar um achado

Usar o modelo da seção 9 do docs/arquitetura/06-checklist-de-revisao.md:

```markdown
### Achado: [descrição concreta]

- Regras relacionadas: [IDs]
- Status: [PA/AU/NV]
- Prioridade: [P0/P1/P2/P3 e motivo]
- Evidência: [arquivo, função, política, teste e ambiente]
- Nível de verificação: [inspeção local / teste executado / remoto verificado]
- Como reproduzir: [passos]
- Comportamento observado: [resultado real]
- Comportamento esperado: [contrato aplicável]
- Impacto: [dados/usuário afetados]
- Correção proposta: [mudança mínima suficiente]
- Dados existentes: [migration, compatibilidade e recuperação necessárias]
- Validação após correção: [cenários e resultados]
- Limitações: [o que não foi possível comprovar]
```