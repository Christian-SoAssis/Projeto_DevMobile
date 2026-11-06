# 06 - Checklist de revisão da arquitetura

[Índice e convenções](README.md)

## 1. Finalidade e modo de preenchimento

Este checklist reúne os critérios dos cinco documentos. **Nenhuma verificação foi executada contra o repositório nesta entrega.** Todas as linhas começam como `não verificado` (NV). As verificações propostas derivam da teoria; os testes e complementos de engenharia são uma adaptação para revisar o Enlace, não uma lista oficial de exigências do professor.

Antes de preencher, registrar:

| Informação | Valor a preencher na auditoria |
| --- | --- |
| Data e responsável | A preencher |
| Branch e commit inspecionados | A preencher |
| Expo SDK e versões relevantes | A preencher |
| Plataformas/dispositivos | A preencher |
| Expo Go, development build ou build final | A preencher |
| Ambiente Supabase inspecionado | A preencher; não registrar credenciais |
| Funcionalidades em escopo | A preencher |
| Fontes adicionais de requisitos | A preencher |

### Status

| Código | Status | Critério |
| --- | --- | --- |
| AT | Atendido | Há evidência suficiente para o comportamento descrito |
| PA | Parcial | Parte do comportamento existe, mas há lacuna demonstrada |
| AU | Ausente | A investigação confirmou que a garantia aplicável não existe |
| NA | Não aplicável | O recurso ou condição não faz parte do escopo, com justificativa |
| NV | Não verificado | Falta acesso, execução, informação ou inspeção suficiente |

Não usar AU apenas porque um nome de função não foi encontrado. Uma solução equivalente pode atender à regra. AT deve indicar o nível da evidência: código inspecionado, teste executado, aparelho usado ou configuração remota consultada. Um teste que não pôde ser executado continua não executado, mesmo que o código pareça correto.

### Prioridade sugerida, após demonstrar a falha

- **P0:** acesso indevido, segredo exposto ou perda/corrupção de dados comprovada; tratar antes de publicar.
- **P1:** falha em fluxo principal, duplicação, sincronização sem recuperação ou promessa offline descumprida.
- **P2:** desempenho, experiência de uso, clareza de estados e manutenção sem falha crítica imediata.
- **P3:** melhoria opcional ou futura que depende de necessidade ainda não confirmada.

As prioridades não são automaticamente atribuídas pelo assunto. Um risco hipotético deve ser registrado como hipótese a verificar, não como defeito comprovado.

## 2. Inventário inicial

Antes das regras, localizar evidências de:

- Rotas/telas de criação, edição, consulta e detalhes de anúncios.
- Entrada por câmera e/ou galeria e tratamento de permissões.
- Representação de fotos, localização, disponibilidade e eventual exclusão.
- Banco local, schemas, migrations e atualização da UI.
- Arquivos temporários, persistentes e rotina de limpeza.
- Cliente remoto, autenticação, tabelas, buckets e políticas.
- Fila/estado de sincronização, gatilhos, confirmação e recuperação.
- Funcionalidades opcionais efetivamente presentes: vídeo, QR, álbuns e IA.

Registrar os caminhos reais. Não reorganizar diretórios apenas para que seus nomes coincidam com esta lista.

## 3. Persistência e sincronização

Referência: [01 - Offline-first](01-offline-first.md). A origem e os complementos de cada regra estão no documento.

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| OFF-01 | O contrato offline está definido e leitura/escrita local persistem sem rede? | NV | A preencher |
| OFF-02 | Migrations preservam dados e pendências; mudanças do sync chegam à UI? | NV | A preencher |
| OFF-03 | Identificadores globais e metadados de sync permitem reconhecer o mesmo registro no reenvio? | NV | A preencher |
| OFF-04 | Dado e operação pendente são persistidos atomicamente, com dependências respeitadas? | NV | A preencher |
| OFF-05 | O servidor reconhece reenvios e há retry adequado, sem duplicação? | NV | A preencher |
| OFF-06 | Lote e cursor são consistentes, ou há estratégia de recebimento equivalente justificada? | NV | A preencher |
| OFF-07 | Conflitos e edições durante envio têm regra, sem confirmação indevida de revisão nova? | NV | A preencher |
| OFF-08 | Exclusões propagam e tombstones não são removidos cedo demais? | NV | A preencher |
| OFF-09 | Gatilhos são coordenados e falhas não deixam o worker travado? | NV | A preencher |
| OFF-10 | A UI distingue salvo localmente, pendente, sincronizado e erro? | NV | A preencher |
| OFF-11 | CRUD, localização e mídia usam estratégias adequadas, sem impor rastreamento ou vídeo desnecessários? | NV | A preencher |

Se OFF-06 usar snapshot em lugar de delta, registrar a justificativa e verificar completude/reconciliação. NA só é adequado quando a condição realmente não existe; não deve ocultar um requisito de atualização remota do produto.

## 4. Permissões e seleção

Referência: [02 - Câmera, permissões e seleção](02-camera-permissoes-e-selecao.md).

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| PER-01 | A permissão necessária é solicitada no contexto correto, sem bloquear indevidamente o app? | NV | A preencher |
| PER-02 | Carregamento, negação, impossibilidade de perguntar e retorno das configurações são tratados? | NV | A preencher |
| PER-03 | Configuração nativa e mensagens correspondem aos recursos e ao build testado? | NV | A preencher |
| PER-04 | ImagePicker/CameraView foram escolhidos conforme o requisito e fazem a ação anunciada? | NV | A preencher |
| PER-05 | Cancelamento, assets ausentes e resultados inválidos não geram erros nem registros vazios? | NV | A preencher |
| PER-06 | Tipos, quantidade e opções de seleção são coerentes com o produto e a plataforma? | NV | A preencher |
| PER-07 | Exibir uma URI temporária é distinguido de salvar o arquivo persistentemente? | NV | A preencher |

## 5. Captura, vídeo e códigos

Referência: [03 - Captura de foto, vídeo e QR](03-captura-foto-video-e-qr.md).

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| CAP-01 | A câmera deixa de capturar quando a tela/app não precisa dela? | NV | A preencher |
| CAP-02 | Permissão, layout, prontidão e falhas de montagem são tratados antes da ação? | NV | A preencher |
| CAP-03 | Capturas simultâneas são impedidas e falhas liberam o estado de captura? | NV | A preencher |
| CAP-04 | Refazer/cancelar/aceitar foto não apaga trabalho anterior nem cria uploads descartados? | NV | A preencher |
| CAP-05 | Se houver vídeo, gravação, áudio, limites e interrupção têm estados coerentes? | NV | A preencher |
| CAP-06 | Se houver vídeo, revisão/reprodução e uso de capas têm comportamento adequado? | NV | A preencher |
| CAP-07 | Se houver scanner, tipos são restritos e leituras repetidas não repetem ações? | NV | A preencher |
| CAP-08 | Se houver scanner, o conteúdo é validado antes de abrir destinos ou executar ações? | NV | A preencher |

Se o Enlace utilizar apenas a câmera nativa por ImagePicker, critérios exclusivos da CameraView podem ser NA, desde que essa escolha satisfaça o requisito acadêmico e de produto confirmado.

## 6. Tratamento e arquivos

Referência: [04 - Tratamento e armazenamento de mídia](04-tratamento-e-armazenamento-de-midia.md).

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| MID-01 | Tratamento/compressão têm qualidade e redução medidas; MIME/extensão/bytes são coerentes? | NV | A preencher |
| MID-02 | O arquivo aceito sai do cache temporário e falhas entre filesystem e banco são recuperáveis? | NV | A preencher |
| MID-03 | O banco guarda referências e estados válidos, sem binários grandes/base64 injustificados? | NV | A preencher |
| MID-04 | Se houver exportação/álbum/listagem de galeria, permissões e limites são tratados? | NV | A preencher |
| MID-05 | Listas usam mídia adequada ao tamanho de exibição e tratam ausência/expiração? | NV | A preencher |
| MID-06 | Se houver vídeo, limites e estratégia de upload são adequados ao tamanho e à recuperação? | NV | A preencher |
| MID-07 | EXIF e localização enviados/armazenados correspondem à finalidade e à visibilidade definidas? | NV | A preencher |
| MID-08 | Se houver reconhecimento, segredos e autorização ficam no backend e erros são recuperáveis? | NV | A preencher |
| MID-09 | Limpeza, cancelamento, falta de espaço e progresso preservam arquivos ainda necessários? | NV | A preencher |

## 7. SQLite, Supabase e segurança

Referência: [05 - SQLite, Supabase e segurança](05-sqlite-supabase-e-seguranca.md).

| ID | Pergunta de revisão / evidência esperada | Status | Evidência ou justificativa |
| --- | --- | --- | --- |
| DAT-01 | Conexão/schema têm ciclo de vida definido e não dependem só de CREATE IF NOT EXISTS para evoluir? | NV | A preencher |
| DAT-02 | SQL usa parâmetros ou mecanismo equivalente, sem interpolação insegura? | NV | A preencher |
| DAT-03 | Sessão inicial, expirada e ausente são tratadas sem perder ou enviar pendências com identidade errada? | NV | A preencher |
| DAT-04 | Não há credenciais privilegiadas no cliente, configuração pública ou logs? | NV | A preencher |
| DAT-05 | RLS distingue leitura pública/privada e operações do dono; vínculos entre entidades são autorizados? | NV | A preencher |
| DAT-06 | Políticas do Storage protegem as operações necessárias, o bucket e os caminhos corretos? | NV | A preencher |
| DAT-07 | Referência estável é separada da URL; acesso privado e renovação de URL são tratados? | NV | A preencher |
| DAT-08 | Upload tem identidade estável, corpo/formato compatíveis e reenvio sem duplicação? | NV | A preencher |
| DAT-09 | Sucessos parciais são retomados; só a revisão completamente enviada é confirmada? | NV | A preencher |
| DAT-10 | Troca de conta isola rascunhos, arquivos privados e pendências? | NV | A preencher |
| DAT-11 | Worker, listeners, dependências e classificação de erros permitem novas tentativas? | NV | A preencher |
| DAT-12 | Exclusões e limpeza coordenam linha/arquivo sem ressuscitar ou apagar mídia ainda referenciada? | NV | A preencher |

## 8. Cenários de validação

Executar em ambiente de teste com dados próprios. As contas A e B devem ser contas controladas pela equipe. Interrupções de processo, limpeza de cache e simulação de falhas precisam preservar dados reais. Quando um cenário não puder ser executado, registrar o motivo e a parte validada por inspeção.

| Teste | Procedimento | Resultado esperado | Regras principais |
| --- | --- | --- | --- |
| T01 | Sem internet, criar/editar um anúncio ou rascunho no escopo offline; fechar e reabrir | Dados e fotos aceitas reaparecem; estado remoto continua pendente | OFF-01, OFF-10, MID-02 |
| T02 | Salvar dados e pendências em uma versão antiga; atualizar com migration | Dados preservados, schema atualizado e pendências ainda processáveis | OFF-02, DAT-01 |
| T03 | Interromper uma gravação local antes da confirmação da transação | Não existe dado confirmado sem sua pendência correspondente, nem pendência inválida | OFF-04 |
| T04 | Servidor aceita a mutação, mas a resposta ao cliente é perdida; reenviar | Um único resultado lógico; retry reconhece a operação | OFF-03, OFF-05, DAT-08 |
| T05 | Falhar ao aplicar um item de um lote de pull; reiniciar | Cursor não pula o lote incompleto; repetição mantém consistência | OFF-06 |
| T06 | Editar o mesmo anúncio em dois aparelhos e sincronizar | Política de conflito observável, sem descarte silencioso fora do contrato | OFF-07 |
| T07 | Alterar uma descrição/foto enquanto a revisão anterior está sendo enviada | Confirmar a revisão antiga não elimina a pendência da nova | OFF-07, DAT-09 |
| T08 | Excluir em A; manter B offline e depois sincronizar | Item não reaparece; tombstone/recarga segue política de retenção | OFF-08, DAT-12 |
| T09 | Disparar reconexão e sincronização manual juntas; provocar falha no worker | Sem processamento duplicado; trava liberada para nova tentativa | OFF-09, DAT-11 |
| T10 | Negar câmera, negar permanentemente, conceder nas configurações e voltar | Mensagens e ações corretas, formulário preservado, permissão reavaliada | PER-01, PER-02, PER-03 |
| T11 | Cancelar seletor; retornar asset inválido em teste; selecionar múltiplos itens no limite | Nenhum registro vazio; mídia anterior preservada; limite respeitado | PER-05, PER-06 |
| T12 | Abrir câmera, navegar para outra tela, ir ao background e retornar; tocar rapidamente em capturar | Câmera acompanha ciclo de vida; uma captura por vez; falhas não travam a UI | CAP-01, CAP-02, CAP-03 |
| T13 | Capturar, refazer, aceitar e cancelar em sequências diferentes | Apenas mídias confirmadas seguem para persistência; associação correta ao anúncio | CAP-04, PER-07 |
| T14 | Tratar fotos com orientações, dimensões e formatos diferentes | Saída visual correta, tamanho medido e MIME compatível com os bytes | MID-01, DAT-08 |
| T15 | Após salvar, remover apenas cache temporário em ambiente de teste; simular falta de espaço/cópia interrompida | Arquivos persistentes continuam válidos; falhas não geram falsa confirmação | MID-02, MID-03, MID-09 |
| T16 | Confirmar upload e falhar ao gravar metadados; depois tentar novamente | Reutiliza/reconcilia arquivo remoto e conclui associação sem duplicar | DAT-08, DAT-09 |
| T17 | Expirar sessão durante sync e repetir após autenticação válida | Trabalho preservado e enviado com a conta correta | DAT-03, DAT-11 |
| T18 | Como A, tentar ler/alterar dados privados e arquivos de B; testar usuário não autenticado | Acesso negado onde privado; leitura pública apenas conforme política; escrita protegida | DAT-05, DAT-06 |
| T19 | A cria pendência offline; troca para B; depois retorna para A | B não vê nem envia pendência de A; dados seguem política explícita de preservação | DAT-10 |
| T20 | Expirar uma URL assinada e abrir a foto novamente, online e offline | Renovação autorizada online; cópia local/estado indisponível coerente offline | DAT-07, MID-05 |
| T21 | Remover foto com falha na etapa de banco ou Storage; executar nova tentativa/limpeza | Remoção converge sem afetar outros arquivos; não sobram pendências invisíveis | DAT-12, MID-09 |
| T22 | Inspecionar EXIF do arquivo final e comparar com a localização pública do anúncio | Só os dados pretendidos são expostos; GPS preciso não vaza por acidente | MID-07, OFF-11 |
| T23 | Se houver vídeo, negar áudio, alcançar limite e interromper upload relevante ao tamanho | Estado recuperável; sem gravação oculta; retomada coerente com o contrato | CAP-05, CAP-06, MID-06 |
| T24 | Se houver QR, manter código na câmera e testar conteúdo inválido | Uma ação controlada por leitura; conteúdo inválido não executa ação arbitrária | CAP-07, CAP-08 |
| T25 | Se houver galeria/álbum, negar acesso e testar no build de destino | Erro compreensível e funcionamento dentro das permissões reais | MID-04 |
| T26 | Se houver IA, invocar análise com arquivo próprio e de outra conta; simular timeout | Autorização aplicada; segredo ausente no cliente; falha não destrói dados | MID-08, DAT-04 |
| T27 | Gravar título com apóstrofo e entrada semelhante a SQL | Conteúdo tratado como dado, sem alterar comandos ou outras linhas | DAT-02 |
| T28 | Sincronizar alteração remota com a lista aberta | UI reflete a alteração pelo banco local, sem estado contraditório | OFF-02, OFF-10 |

Esses cenários podem ser automatizados onde fizer sentido, mas permissões nativas, câmera, arquivos, build e políticas remotas também precisam de validação no ambiente apropriado. Não declarar sucesso em aparelho a partir de testes unitários apenas.

## 9. Modelo de registro de achado

Copiar e preencher para cada problema demonstrado. Não preencher com suposições.

```markdown
### Achado: [descrição concreta]

- Regras relacionadas: [IDs]
- Status: [PA/AU/NV, conforme evidência]
- Prioridade: [P0/P1/P2/P3 e motivo]
- Evidência: [arquivo, função, migration/política, teste e ambiente]
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

## 10. Ordem sugerida de correção

1. Corrigir acesso indevido, segredos expostos e perda de dados comprovados.
2. Estabilizar identidade, migrations, arquivo persistente e gravação atômica de pendências.
3. Corrigir idempotência, sucesso parcial, conflitos e exclusões.
4. Ajustar permissões, ciclo de vida, feedback e recuperação dos fluxos principais.
5. Otimizar mídia/listas e avaliar recursos opcionais apenas quando necessários.

Adaptar a ordem às dependências reais. Uma mudança de schema pode ser pré-requisito para uma correção do sync. Não resolver tudo em uma refatoração única sem necessidade.

## 11. Critério para encerrar a revisão

A revisão termina com cada item classificado e justificado, os problemas relevantes corrigidos ou explicitamente pendentes e as limitações de verificação registradas. Ela não exige AT para funcionalidades fora do escopo: NA bem fundamentado é um resultado válido.

O relatório deve distinguir:

- O que foi encontrado no código atual.
- O que foi alterado, quando a implementação tiver sido solicitada.
- Quais testes e verificações foram efetivamente executados.
- O que depende de configuração remota, aparelho físico ou decisão da equipe.

Preservar esse registro ao evoluir o projeto. A documentação só passa a descrever uma decisão adotada quando a equipe a registra e a implementação correspondente é identificada.
