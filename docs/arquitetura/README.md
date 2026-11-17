# Enlace - Referência de arquitetura para revisão assistida por IA

Esta documentação adapta os cinco PDFs da disciplina de Desenvolvimento Mobile para consulta dentro do repositório. Seu objetivo é ajudar a equipe e o agente de IA a compreender a teoria, localizar evidências no código e corrigir problemas de arquitetura de forma incremental.

**Esta é uma referência de revisão, não um diagnóstico do Enlace.** O repositório não foi inspecionado na elaboração destes documentos. Nenhum requisito deve ser marcado como implementado, ausente ou defeituoso sem evidência. Os nomes de entidades e estados sugeridos são conceituais e devem ser associados aos nomes reais do projeto.

## 1. Instalação e ordem de leitura

Extraia o ZIP na raiz do projeto, preservando `docs/arquitetura/`. Se essa pasta já contiver arquivos com os mesmos nomes, compare e integre as versões antes de sobrescrever.

| Ordem | Documento | Finalidade |
| --- | --- | --- |
| 0 | [README](README.md) | Escopo, origem, critérios e instruções de uso |
| 1 | [Offline-first](01-offline-first.md) | Banco local, ORM, migrations, sincronização, conflitos e exclusões |
| 2 | [Câmera, permissões e seleção](02-camera-permissoes-e-selecao.md) | Permissões, ImagePicker e seleção de mídia |
| 3 | [Captura de foto, vídeo e QR](03-captura-foto-video-e-qr.md) | CameraView, ciclo de vida, captura e leitura de códigos |
| 4 | [Tratamento e armazenamento de mídia](04-tratamento-e-armazenamento-de-midia.md) | Compressão, persistência, galeria, miniaturas e reconhecimento |
| 5 | [SQLite, Supabase e segurança](05-sqlite-supabase-e-seguranca.md) | Autenticação, RLS, Storage, metadados e integração |
| 6 | [Checklist de revisão](06-checklist-de-revisao.md) | Auditoria por evidência, prioridades e cenários de validação |

Os sete arquivos são complementares. O documento 01 define o contrato geral de sincronização; o 05 o aplica à integração com fotos e Supabase. O documento 04 trata do arquivo físico, que não deve ser confundido com sua linha no banco.

## 2. Fontes e rastreabilidade

As referências usam a página física do PDF, contando a capa como página 1. Os PDFs não fazem parte deste ZIP. Os nomes abaixo permitem localizá-los no material original.

| Código | PDF de origem | Páginas | Documento principal |
| --- | --- | --- | --- |
| S0 | `offline-first-expo.pdf` | 37 | 01 |
| S1 | `01_Camera_Fundamentos_Permissoes_ImagePicker.pdf` | 21 | 02 |
| S2 | `02_Camera_ExpoCamera_Foto_Video_QR.pdf` | 26 | 03 |
| S3 | `03_Camera_Tratamento_Compressao_Reconhecimento.pdf` | 23 | 04 |
| S4 | `04_Camera_SQLite_Supabase.pdf` | 26 | 05 |

Cada documento contém uma tabela dos trechos de origem. Menções como **S0, pp. 18-23** apontam para esses PDFs. Esta adaptação reorganiza o conteúdo; não é uma transcrição integral nem uma especificação oficial adicional do professor.

### Como interpretar as orientações

- **Aula:** conceito ou comportamento apresentado nos slides, reescrito em linguagem contínua.
- **Aplicação ao Enlace:** tradução desse conceito para anúncios de adoção, fotos, rascunhos e localização. É uma proposta de aplicação, sujeita ao escopo real.
- **Complemento de implementação:** precaução ou detalhamento acrescentado para não transformar um exemplo didático incompleto em código de produção. Não atribuir esse complemento ao professor.

Os identificadores `OFF`, `PER`, `CAP`, `MID` e `DAT` ligam regras ao checklist. Um identificador é um critério de revisão, não prova de que a disciplina exige determinada biblioteca.

## 3. Escopo e decisões que não estão tomadas

O contexto é um app de adoção de animais com anúncios, fotos, localização e funcionalidades offline. A existência e o comportamento de cada funcionalidade precisam ser confirmados no repositório e nos requisitos da equipe.

| Tema | Como aplicar |
| --- | --- |
| Anúncios e rascunhos offline | Verificar leitura, escrita, persistência e sincronização do conjunto de dados prometido ao usuário |
| Fotos de anúncios | Verificar captura/seleção, tratamento, arquivo persistente, upload e autorização |
| Localização de anúncio | Verificar captura e sincronização, sem presumir rastreamento contínuo |
| Vídeo, QR, álbuns e reconhecimento por IA | Aplicar as regras somente se esses recursos fizerem parte do escopo |
| Drizzle | Opção ensinada; não instalar nem substituir SQL direto apenas por aparecer nos slides |
| CRDT, upload resumível e motor externo de sync | Alternativas para necessidades específicas, não requisitos universais |
| Visibilidade pública de anúncios | Decisão de produto; não aplicar indiscriminadamente a regra de fotos privadas do exemplo |

O offline-first não torna disponíveis dados nunca baixados. Também não elimina validação e autorização do servidor. Uma alteração local pendente pode ser recusada na sincronização e precisa de tratamento explícito.

Antes de alterar código, confira `package.json`, lockfile, configuração Expo, rotas, repositórios, migrations e políticas SQL. As APIs descritas são as usadas nas aulas; assinaturas, imports, disponibilidade no Expo Go e detalhes por plataforma devem ser conferidos na documentação oficial correspondente às versões instaladas. Não atualizar dependências em massa para fazer um exemplo caber no projeto.

## 4. Fluxo de trabalho do agente

1. Leia as instruções existentes do repositório e os documentos desta pasta.
2. Identifique o escopo real e mapeie UI, persistência, arquivos, autenticação, rede e sincronização. Não imponha uma nova árvore de pastas sem necessidade.
3. Preencha o checklist com `atendido`, `parcial`, `ausente`, `não aplicável` ou `não verificado`, citando arquivos, funções, migrations e testes.
4. Diferencie falta de evidência de falta de implementação. Políticas vistas apenas no SQL local não comprovam que foram aplicadas no ambiente remoto.
5. Relate riscos concretos: perda de dados, acesso indevido, duplicação, estados incorretos e falhas de experiência de uso.
6. Proponha correções pequenas, ordenadas por impacto e dependências. Explique migrations e recuperação de dados existentes.
7. Quando a implementação for solicitada, faça as correções no escopo autorizado e execute verificações proporcionais ao risco.
8. Atualize o relatório com o que foi comprovado, o que mudou e o que permanece não verificado.

Não reescrever o app inteiro por preferência de arquitetura. Não apagar banco, fila ou arquivos pendentes para esconder erros. Não afirmar que uma política remota, captura em aparelho ou sincronização offline funciona sem observação adequada.

### Prompt sugerido para a primeira auditoria

```text
Leia docs/arquitetura/README.md e os seis documentos referenciados.
Analise o código atual do Enlace e preencha o checklist por evidência.
Para cada item, informe status, arquivo/função ou política relevante,
risco concreto e correção proposta. Justifique os itens não aplicáveis.
Diferencie código local de configuração remota efetivamente verificada.
Nesta etapa, entregue o diagnóstico e um plano incremental de correção.
Não implemente recursos opcionais só porque aparecem no material da aula.
```

### Trecho opcional para integrar ao AGENTS.md existente

O ZIP não cria nem substitui `AGENTS.md`. Se o agente usado pela equipe reconhecer esse arquivo, a equipe pode acrescentar o trecho abaixo, preservando as instruções já existentes:

```markdown
## Referência de arquitetura do Enlace

Antes de revisar persistência, mídia, permissões, segurança ou sincronização,
leia docs/arquitetura/README.md e os documentos relacionados à alteração.
Use docs/arquitetura/06-checklist-de-revisao.md para registrar evidências.
Distinga teoria da aula, aplicação proposta e complemento de implementação.
Não trate recursos opcionais como obrigatórios nem presuma falhas sem ler o código.
Preserve dados existentes e valide cenários de falha relevantes à mudança.
```

## 5. Limites dos exemplos das aulas

| Exemplo | Leitura correta para revisão |
| --- | --- |
| `AUTOINCREMENT` na tabela local de fotos | Pode identificar linhas locais; não basta como identidade compartilhada entre aparelhos |
| `sincronizado = 0/1` | Simplifica a aula; fluxos com edição concorrente e etapas separadas precisam representar pendências e falhas adequadamente |
| Loop de upload seguido de insert | Explica a ordem feliz; não resolve sozinho reenvio, duplicação ou sucesso parcial |
| `Date.now()` no nome do arquivo | Exemplo simples; não garante a identidade estável necessária para reenvios idempotentes |
| `isConnected` como gatilho | Sinal para tentar sincronizar; não comprova que a API está acessível |
| “A foto nunca se perde” | Intenção de salvar local primeiro; depende de persistência real do arquivo e não protege contra desinstalação ou perda do aparelho |
| Upload antes ou depois do registro | Distinguir anúncio, registro de foto e arquivo; o contrato escolhido deve suportar falhas parciais |

Esses limites são detalhados nos documentos correspondentes. Quando a equipe tomar uma decisão, registre sua justificativa junto ao código ou à documentação; não apresente uma proposta desta pasta como decisão já adotada.
