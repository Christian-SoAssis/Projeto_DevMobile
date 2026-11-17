# 05 - SQLite, Supabase e segurança

[Índice e convenções](README.md) · [Checklist](06-checklist-de-revisao.md)

## 1. Origem e objetivo

Fonte principal: **S4 - `04_Camera_SQLite_Supabase.pdf`**. Fonte complementar: S0 para outbox, idempotência, conflitos e exclusões.

| Páginas de S4 | Conteúdo adaptado |
| --- | --- |
| 2-3 | Separação entre arquivo, SQLite, Storage e Postgres |
| 5-10 | Configuração, tabela, RLS, cliente, autenticação e chaves |
| 12-15 | Banco local, CRUD parametrizado e Provider |
| 17-19 | Upload, URLs e metadados remotos |
| 20-23 | Fluxo de foto, sincronização, conectividade e falhas |
| 24-25 | Projeto didático e critérios de avaliação |

Objetivo: definir critérios para integrar persistência e nuvem. O exemplo da aula é um diário de fotos privadas. O Enlace tem anúncios de adoção, que podem precisar de leitura pública. Essa diferença exige uma política explícita, não a cópia indiscriminada das permissões do exercício.

## 2. Responsabilidades e modelo de referência

| Componente | Responsabilidade |
| --- | --- |
| Arquivos locais | Guardar bytes de fotos, vídeos e miniaturas |
| SQLite | Manter metadados, referências, rascunhos, pendências e leitura offline |
| Supabase Auth | Identificar usuário e manter sessão |
| Supabase Storage | Armazenar arquivos remotos em buckets |
| Postgres | Manter dados relacionais, propriedade e referências remotas |
| API/Edge Function, quando usada | Validar operações de servidor e executar lógica que não deve residir no app |

**Aula.** A tabela remota `fotos` contém `id` UUID, `user_id`, `titulo`, `caminho` e `criado_em`. `auth.uid()` pode preencher o dono por padrão. O modelo local usa `uri_local`, `caminho_remoto`, `titulo` e `sincronizado`, com `0` para pendente e `1` para enviado.

**Complemento de implementação:** um valor default não é autorização. O servidor ainda precisa impedir que o cliente forneça um dono diferente. Um UUID remoto gerado a cada insert também não resolve sozinho a identidade de registros criados offline: é preciso conservar a identidade global ou uma chave idempotente/mapeamento equivalente.

**Aplicação ao Enlace:** fotos devem se relacionar ao anúncio certo. A estrutura pode usar um identificador local adicional, mas precisa identificar de modo estável a mesma foto e o mesmo anúncio no servidor. Não criar tabelas novas apenas para reproduzir os nomes do exemplo.

## 3. Banco e autenticação

### DAT-01 - Centralizar o acesso local e inicializar o schema corretamente

**Aula:** S4, pp. 12-15. Abrir o banco, inicializar tabelas e habilitar WAL conforme necessário. `SQLiteProvider` disponibiliza o banco aos filhos, `useSQLiteContext()` permite acessá-lo e `onInit` executa a inicialização.

**Complemento de implementação:** `CREATE TABLE IF NOT EXISTS` sozinho não atualiza a estrutura de uma tabela antiga. Usar migrations para alterações, como descrito em OFF-02. Não criar conexões e migrações repetidamente a cada renderização. Um módulo de banco sem Provider também pode ser válido se cumprir essas garantias.

**Verificar:** a conexão e a inicialização têm ciclo de vida definido; componentes não acessam tabelas antes da migração; dados existentes são preservados.

### DAT-02 - Parametrizar os valores do SQL

**Aula:** S4, p. 14. Usar placeholders e parâmetros:

```tsx
await db.runAsync(
  "INSERT INTO fotos (uri_local, titulo) VALUES (?, ?)",
  [uri, titulo]
);
```

**Complemento de implementação:** não concatenar entradas do usuário ao SQL. Identificadores dinâmicos, como nome de coluna de ordenação, precisam de uma lista permitida; placeholders de valores não substituem essa validação. Query builders são aceitos quando parametrizam de forma equivalente.

**Verificar:** título com apóstrofo ou texto semelhante a SQL é armazenado como dado, sem alterar a consulta.

### DAT-03 - Vincular chamadas remotas a uma sessão válida

**Aula:** S4, pp. 8-9. O exemplo cria o cliente Supabase com adaptador de armazenamento de sessão, usa `signInWithPassword` e acompanha mudanças com `onAuthStateChange`. A sessão identifica o usuário nas chamadas.

**Complemento de implementação:** tratar inicialização, expiração e ausência de sessão. Não executar uma pendência de um usuário com a sessão de outro. Não transformar AsyncStorage, usado no exemplo para sessão, em banco de filas ou garantia de proteção de todos os dados sensíveis.

**Aplicação ao Enlace:** leitura pública, se existir, pode ter contrato diferente da publicação autenticada. Editar offline um rascunho previamente autorizado não equivale a obter nova autorização do servidor sem internet.

**Verificar:** sessão expirada suspende/recupera o envio adequadamente, preservando a pendência; listener é limpo quando necessário.

### DAT-04 - Manter segredos fora do cliente

**Aula:** S4, p. 10; S3, p. 19. URL do projeto e chave pública do cliente podem estar no app; `service_role`, senha do banco e chave secreta de IA não podem.

**Complemento de implementação:** variáveis `EXPO_PUBLIC_*` são destinadas ao cliente e não tornam um segredo seguro. A chave pública não substitui RLS. Não expor tokens em logs ou mensagens de erro. Se houver segredo já publicado, tratar a revogação/rotação, não apenas retirar a linha do arquivo.

**Verificar:** configuração, histórico relevante, bundle e logs não contêm credenciais privilegiadas; chamadas que precisam delas acontecem no servidor autorizado.

## 4. Autorização de dados e arquivos

### DAT-05 - Definir RLS por operação e por visibilidade do dado

**Aula:** S4, pp. 6-7. Habilitar RLS e escrever políticas. O exercício restringe linhas a `user_id = auth.uid()` para usuários autenticados.

| Elemento | Função conceitual |
| --- | --- |
| `USING` | Determinar quais linhas existentes podem ser acessadas pela operação correspondente |
| `WITH CHECK` | Validar a nova linha inserida ou a versão resultante da atualização |
| `auth.uid()` | Identificar o usuário autenticado no contexto da requisição |
| RLS habilitada sem política aplicável | Bloquear acesso pelos papéis sujeitos à RLS; não significa bloquear papéis privilegiados que a contornam |

**Aplicação proposta ao Enlace, não decisão já adotada:**

| Recurso/operação | Política a definir |
| --- | --- |
| Consultar anúncio publicado | Pode ser público ou restrito, conforme requisito |
| Consultar rascunho | Restrito ao proprietário |
| Criar anúncio | Usuário autenticado cria em seu próprio nome |
| Editar/excluir/marcar adotado | Proprietário ou papel de moderação explicitamente autorizado |
| Consultar dados de contato/localização precisa | Exposição mínima compatível com a funcionalidade |

**Complemento de implementação:** leitura pública não deve permitir escrita pública. Testar políticas em conjunto, pois uma política permissiva adicional pode ampliar o acesso. Validar o vínculo foto-anúncio para evitar associar mídia a um anúncio de outra pessoa; o simples `user_id` de uma foto pode não provar a propriedade do anúncio relacionado.

**Verificar:** usuários A e B, usuário não autenticado e eventual moderador têm somente os acessos previstos. Conferir políticas realmente aplicadas no ambiente, quando houver acesso autorizado para isso.

### DAT-06 - Aplicar políticas específicas ao Storage

**Aula:** S4, p. 7. O exemplo de upload exige bucket `fotos` e primeira pasta do caminho igual ao ID do usuário.

**Complemento de implementação:** uma política de insert no bucket não concede automaticamente select, update ou delete. Reenvios com sobrescrita e remoções precisam das permissões correspondentes ao contrato implementado. Nome de pasta não substitui política no servidor. Também verificar restrições de tipo e tamanho do arquivo.

**Aplicação ao Enlace:** definir se fotos publicadas podem ser lidas publicamente e como rascunhos permanecem privados. Não tornar um bucket público apenas para contornar uma imagem que não abriu.

**Verificar:** A não envia, substitui ou apaga arquivos na área de B; leitura segue a regra de visibilidade escolhida.

### DAT-07 - Diferenciar caminho do arquivo e URL de acesso

**Aula:** S4, p. 18. `createSignedUrl(caminho, 3600)` gera acesso temporário ao bucket privado no exemplo; `getPublicUrl(caminho)` fornece endereço para objeto público.

**Complemento de implementação:** guardar uma referência estável, como bucket e caminho. Uma URL assinada expira e não deve ser a única identidade persistida da mídia. Gerar URL não torna automaticamente o objeto público nem substitui a autorização necessária. Uma URL assinada concede acesso enquanto válida a quem a obtiver; evitar exposição desnecessária.

**Verificar:** URL expirada pode ser renovada pelo fluxo autorizado; offline utiliza cópia local disponível ou mostra indisponibilidade, em vez de fingir que uma URL remota funciona sem rede.

## 5. Upload, metadados e consistência

### DAT-08 - Usar um contrato de envio estável

**Aula:** S4, pp. 17 e 19. O app lê os bytes do arquivo, faz upload no bucket e grava os metadados na tabela Postgres pela API. O exemplo usa `arrayBuffer()`, `contentType: "image/jpeg"` e um caminho com ID do usuário.

**Complemento de implementação:** conferir a leitura de arquivo local e o formato de corpo suportados pela versão/plataforma, sem presumir que todo `fetch(file://...)` terá o mesmo comportamento. MIME, extensão e bytes precisam ser coerentes. Manter identidade estável por foto/operação para não criar outro nome de arquivo em cada retry.

`upsert` não é uma solução universal de idempotência: se atualizar sem verificar versão, pode sobrescrever edição mais nova. Definir a operação remota e as restrições que reconhecem uma tentativa repetida.

**Verificar:** reenviar a mesma foto após timeout não cria novos arquivos e novas linhas sem controle; um arquivo inválido não fica marcado como enviado.

### DAT-09 - Confirmar etapas e recuperar sucesso parcial

**Aula:** S4, pp. 20-21, mostra capturar, comprimir, gravar local, enviar ao Storage/Postgres e marcar sincronizado. S0, pp. 28-29, trata upload como etapa separada do dado estruturado.

As ordens apresentadas nos PDFs são compatíveis quando se distingue o registro pai do anúncio, a associação da foto e o arquivo. Para o Enlace, definir o contrato usado, por exemplo:

1. Preservar o arquivo local tratado.
2. Gravar anúncio/rascunho, foto e pendências locais atomicamente quando couber.
3. Sincronizar o anúncio pai, se a associação remota depender dele.
4. Enviar o arquivo usando um identificador estável.
5. Gravar ou confirmar a associação/metadados remotos da foto.
6. Confirmar localmente somente a operação e revisão efetivamente concluídas.

Também é possível criar metadados remotos pendentes antes do upload, desde que a incompletude seja representada e recuperada. A aula não define uma transação distribuída entre arquivo local, SQLite, Storage e Postgres.

**Complemento de implementação:** representar etapas suficientes para retomar o trabalho; isso pode ser feito por estados, jobs ou outro mecanismo coerente. Uma proposta de estados conceituais é:

| Estado | Significado |
| --- | --- |
| Pendente de arquivo | Há cópia local; upload ainda não confirmado |
| Arquivo enviado, metadados pendentes | O objeto remoto existe; falta concluir a associação |
| Sincronizado | Todas as etapas necessárias daquela revisão foram confirmadas |
| Erro recuperável | Há falha registrada e uma etapa conhecida para retomar |
| Ação do usuário necessária | Rejeição permanente, arquivo perdido ou conflito que não pode ser resolvido sozinho |

O booleano `sincronizado` é suficiente apenas se o restante do modelo preservar todas as informações necessárias ao contrato. Não trocar campos sem migration e sem considerar pendências existentes.

| Ponto de falha | Comportamento esperado |
| --- | --- |
| Falha no upload | Preservar arquivo local e pendência |
| Upload concluído, insert falha | Retomar metadados sem gerar outro arquivo a cada tentativa |
| Remoto concluiu, resposta foi perdida | Reconciliar pela identidade estável; não duplicar |
| Local editado durante o envio | Manter a nova revisão pendente, mesmo após confirmar a antiga |
| Arquivo local desapareceu | Informar a falha; não confirmar sincronização inexistente |

**Verificar:** simular cada interrupção relevante e observar o estado após reabrir o app.

### DAT-10 - Isolar dados e pendências entre contas

**Complemento de implementação derivado da combinação de offline-first e autenticação (S0, pp. 3-7; S4, pp. 6-9).** O cache/banco local e os jobs precisam estar associados à conta correta. Essa regra é uma aplicação ao Enlace, não uma seção explícita dos slides.

Ao trocar a conta A pela B, impedir a exibição indevida de rascunhos privados de A e o envio de pendências de A usando a sessão de B. Definir se os dados ficam separados e preservados ou se são removidos conforme uma política de saída. Não apagar silenciosamente trabalho pendente para facilitar logout.

**Verificar:** criar rascunho offline como A, sair e entrar como B. B não deve ver nem publicar a pendência de A. Retornar a A deve seguir a política documentada de preservação.

### DAT-11 - Coordenar gatilhos, limites e classificação de erros

**Aula:** S4, pp. 21-23; S0, pp. 20 e 33. Buscar pendências, sincronizar ao reconectar e impedir execuções simultâneas.

**Complemento de implementação:** limitar o trabalho por lote, remover listeners ao encerrar seu ciclo de vida e liberar travas mesmo se uma operação falhar. Uma falha permanente em uma foto não deve bloquear indefinidamente todos os itens independentes, mas relações pai-filho precisam ser respeitadas.

| Situação | Tratamento a investigar |
| --- | --- |
| Rede/API indisponível | Preservar pendência e tentar depois com backoff |
| Sessão expirada | Recuperar autenticação conforme o fluxo; não trocar o dono |
| Upload 403 | Conferir autorização/política e sessão; não liberar acesso global |
| Conflito de versão | Aplicar política de OFF-07 |
| Dados inválidos ou formato recusado | Marcar ação necessária e explicar a correção |
| Lista remota vazia | Investigar políticas, filtros e sessão antes de concluir que não há dados |

**Verificar:** erro em uma execução não impede permanentemente novas tentativas nem marca toda a fila como concluída.

### DAT-12 - Coordenar exclusão e limpeza de arquivos remotos

**Aula:** S0, p. 23, fornece tombstones para dados; S3, p. 22, trata limpeza. **Complemento de implementação:** excluir uma linha no Postgres não implica, por si só, excluir o objeto no Storage, e o inverso também vale.

**Aplicação ao Enlace:** definir como remover uma foto, excluir um anúncio e tratar arquivos órfãos. Preservar evidência de exclusão até a sincronização necessária e retomar etapas de limpeza que falharam. Verificar se o arquivo ainda é referenciado antes de removê-lo. Uma operação de exclusão repetida deve aceitar que o alvo já tenha sido removido, conforme o contrato.

**Verificar:** excluir uma foto com rede instável não a faz reaparecer; a limpeza não remove mídia de outro anúncio ou a única cópia de uma pendência.

## 6. Critérios de avaliação da aula aplicados à auditoria

S4, p. 25, organiza a avaliação em funcionalidade, dados, segurança e qualidade. No Enlace, procurar evidências correspondentes:

- Funcionalidade: permissões, captura/seleção e revisão; QR/vídeo somente se exigidos.
- Dados: banco local correto, arquivos preservados e sincronização recuperável.
- Segurança: políticas de acesso e ausência de segredos no cliente.
- Qualidade: estados compreensíveis, tratamento de falhas e responsabilidades identificáveis no código.

O projeto “Diário de Fotos” apresentado na aula é uma atividade de referência, não a especificação funcional do Enlace. O [checklist](06-checklist-de-revisao.md) traduz estes critérios em verificações sem presumir o resultado.
