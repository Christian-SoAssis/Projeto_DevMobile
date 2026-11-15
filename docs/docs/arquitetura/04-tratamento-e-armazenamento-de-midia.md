# 04 - Tratamento e armazenamento de mídia

[Índice e convenções](README.md) · [Checklist](06-checklist-de-revisao.md)

## 1. Origem e objetivo

Fonte principal: **S3 - `03_Camera_Tratamento_Compressao_Reconhecimento.pdf`**. Fontes complementares: S0, pp. 28-32; S4, pp. 20-23.

| Páginas de S3 | Conteúdo adaptado |
| --- | --- |
| 2 | Pipeline de mídia |
| 4-6 | Salvar, organizar e listar na galeria |
| 8-9 | Transformações de imagem |
| 11-13 | Resolução, qualidade, formato e medição |
| 14-15 | Vídeo e miniaturas |
| 16 | EXIF e localização |
| 18-21 | Reconhecimento, backend e development build |
| 22-23 | Desempenho, erros, acessibilidade e síntese |

Objetivo: separar o arquivo físico de seus metadados e tornar o fluxo de mídia durável, eficiente e recuperável.

## 2. Pipeline e lugares de armazenamento

**Aula.** O fluxo é capturar/selecionar, tratar, comprimir, guardar e enviar. Cada etapa tem um resultado próprio; “capturado” não significa “salvo permanentemente”, e “salvo localmente” não significa “disponível na nuvem”.

| Local | Conteúdo | Observação |
| --- | --- | --- |
| Cache do app | Arquivos temporários | Pode ser limpo; não sustenta sozinho a promessa de rascunho salvo |
| Diretório persistente do app | Arquivo mantido para consulta e envio | É separado da galeria e ainda pode ser perdido na desinstalação |
| Galeria do usuário | Assets de fotos/vídeos e álbuns | Acesso depende das permissões/plataforma |
| SQLite | URI, dimensões, título, dono, estado e referências, conforme o modelo | Evitar armazenar bytes grandes/base64 como solução padrão |
| Bucket remoto | Arquivo enviado | Acesso controlado pelas políticas do Storage |
| Postgres | Metadados e relações remotas | Não substitui o bucket |

O rótulo “armazenamento de mídia no SQLite” deve ser entendido, nesta arquitetura, como armazenamento de referências e metadados. A imagem ou miniatura fica como arquivo.

## 3. Tratamento e compressão

**Aula.** `expo-image-manipulator` oferece:

| Operação | Efeito |
| --- | --- |
| `resize` | Redimensionar |
| `crop` | Recortar uma área |
| `rotate` | Girar |
| `flip` | Espelhar |

O exemplo usa um contexto de manipulação, aplica transformações, chama `renderAsync()` e salva com `saveAsync()`. A sintaxe deve ser ajustada à versão instalada; não misturar APIs de versões diferentes.

```tsx
// Exemplo didático da aula. A rotação não é obrigatória para o Enlace.
const contexto = ImageManipulator.manipulate(uri);
contexto.resize({ width: 1080 }).rotate(90);
const imagem = await contexto.renderAsync();
const resultado = await imagem.saveAsync({
  compress: 0.7,
  format: SaveFormat.JPEG,
});
```

Informar só a largura preserva a proporção nesse fluxo. A imagem de saída ainda precisa ser incorporada ao armazenamento persistente escolhido.

| Alavanca | O que controla | Consequência |
| --- | --- | --- |
| Resolução | Número de pixels | Pode diminuir muito o tamanho para exibição em telas pequenas |
| Qualidade | Detalhes preservados na codificação | Pode reduzir bytes com perdas visuais |
| Formato | Representação, como JPEG, PNG ou WEBP | Afeta compatibilidade, transparência e tamanho |

Os valores 1080 px, qualidade 0,7 e redução aproximada de 3-6 MB para 300 KB são exemplos, não garantias. A escolha deve considerar fotos reais de animais, nitidez e uso no aplicativo.

## 4. Regras verificáveis

### MID-01 - Tratar e medir a imagem antes do upload

**Aula:** S3, pp. 8-13. Redimensionar e comprimir antes de enviar, usando resolução, qualidade e formato adequados.

**Complemento de implementação:** manter coerência entre os bytes gerados, extensão e MIME type; converter para JPEG não é apenas renomear `.png` para `.jpg`. Evitar ampliar imagens pequenas sem finalidade. Conferir orientação e aparência após transformação.

**Verificar:** comparar tamanho antes/depois e qualidade visual com amostras reais. A redução percentual pode ser calculada por `(bytesAntes - bytesDepois) / bytesAntes * 100`. Não assumir que `compress: 0.7` significa 70% do tamanho original.

### MID-02 - Preservar o arquivo antes de prometer durabilidade

**Aula:** S4, p. 23, orienta copiar do cache para `documentDirectory`; S0, pp. 28-29, separa arquivo de referência.

**Aplicação ao Enlace:** uma foto aceita em rascunho precisa sobreviver ao fechamento do app e à limpeza do cache temporário. Usar o diretório persistente e a API de arquivos correspondentes à versão instalada; o nome citado no slide não obriga o uso de uma API legada.

**Complemento de implementação:** SQLite e filesystem não compartilham uma única transação. Um fluxo possível é concluir a cópia, verificar que o destino existe e depois registrar URI e pendência em transação local. Se ocorrer falha entre as etapas, detectar referências quebradas ou arquivos órfãos na recuperação. Não remover o único arquivo válido antes de finalizar a cópia.

**Verificar:** aceitar a foto, interromper o app e reabrir; a foto segue disponível, ou a operação informa uma falha recuperável sem alegar sucesso.

### MID-03 - Guardar referências e estados coerentes no banco

**Aula:** S0, pp. 28-29; S4, pp. 12-13. O modelo pode conter `id`, `uri_local`, referência remota, status e hash.

**Complemento de implementação:** um hash pode auxiliar deduplicação/verificação, mas não substitui a identidade da operação nem autorização. A mesma foto pode ser legitimamente associada a anúncios distintos. Não guardar base64 ou metadados extensos sem finalidade concreta.

**Verificar:** metadados apontam para o arquivo certo; upload pendente tem uma fonte disponível; o registro não é marcado como pronto quando o arquivo ainda não existe.

### MID-04 - Tratar a galeria como um fluxo explícito

**Aula:** S3, pp. 4-6. `expo-media-library` fornece as operações abaixo, sujeitas às permissões necessárias:

| Método | Função |
| --- | --- |
| `saveToLibraryAsync(uri)` | Salvar na galeria |
| `createAssetAsync(uri)` | Criar asset |
| `getAlbumAsync()` | Localizar álbum |
| `createAlbumAsync()` | Criar álbum |
| `addAssetsToAlbumAsync()` | Adicionar assets ao álbum |
| `getAssetsAsync()` | Consultar assets, com paginação/limite e ordenação |

O exemplo cria ou reutiliza um álbum do app e lista 20 fotos por data. Esses nomes e limites são didáticos. A aula alerta para limitações de acesso à galeria no Expo Go para Android.

**Aplicação ao Enlace:** salvar uma foto no armazenamento interno não deve automaticamente duplicá-la na galeria. Só implementar exportação/álbum se houver essa necessidade.

**Verificar:** negação de acesso à galeria tem tratamento; a função funciona no build/plataforma de destino; uma consulta não tenta carregar toda a biblioteca de uma vez.

### MID-05 - Usar miniaturas e carregamento progressivo quando necessários

**Aula:** S0, p. 29; S3, pp. 14-15 e 22. Listas devem preferir imagens menores. `expo-video-thumbnails` extrai uma imagem do vídeo; o exemplo usa `time: 1000` em milissegundos.

**Complemento de implementação:** persistir a miniatura e sua referência se ela for necessária offline. Não interpretar a frase “guardar miniatura no SQLite” como obrigação de armazenar o binário no banco. Exibir estado alternativo para imagem ausente ou URL expirada.

**Verificar:** a listagem não baixa um vídeo completo para mostrar sua capa nem exige originais enormes para cada cartão; mídia já preservada pode ser exibida offline.

### MID-06 - Tratar vídeos com limites e recuperação proporcionais ao tamanho

**Aula:** S3, p. 14; S0, pp. 30-31. Limitar qualidade, duração e tamanho antes/durante gravação. Para arquivos grandes, considerar upload resumível, persistência da sessão, consulta do offset remoto após falha, preferência por Wi-Fi e atenção à bateria. Transcodificação pode ficar no servidor; HLS é citado para streaming.

**Aplicação ao Enlace:** somente se vídeo fizer parte do escopo. Upload resumível não é obrigação automática para um aplicativo que só envia fotos ou vídeos muito pequenos.

**Complemento de implementação:** não confiar apenas em um contador local de bytes enviados; confirmar o progresso aceito pelo servidor. Se o arquivo sumiu, informar falha e oferecer recuperação possível, sem marcar upload concluído.

**Verificar:** interromper e retomar um envio relevante ao tamanho adotado; não reiniciar ou duplicar indiscriminadamente o arquivo quando o contrato for resumível.

### MID-07 - Minimizar EXIF e exposição de localização

**Aula:** S3, p. 16; S0, p. 26. Metadados podem conter GPS e informações pessoais. Solicitar e guardar somente o necessário; explicar a coleta de localização.

**Aplicação ao Enlace:** distinguir localização necessária para busca de animais de coordenadas precisas da casa do tutor. Não publicar automaticamente GPS embutido na foto só porque o anúncio usa um mapa. A granularidade pública é uma decisão de produto a registrar.

**Complemento de implementação:** solicitar `exif: false` ou não retornar EXIF à aplicação não comprova, por si só, que o arquivo final não contém metadados sensíveis. Inspecionar a saída realmente enviada e sanitizá-la se necessário. Esta orientação é técnica; o material não constitui uma análise jurídica completa.

**Verificar:** origem da localização, finalidade, campos persistidos, permissões e metadados da imagem enviada correspondem ao comportamento definido.

### MID-08 - Manter reconhecimento de imagens atrás de um backend seguro

**Aula:** S3, pp. 18-21. A aula diferencia QR/códigos nativos, visão por API, IA no aparelho e TensorFlow.js. A disponibilidade no Expo Go ou em development build é uma característica a confirmar para a versão e biblioteca escolhidas.

Na arquitetura apresentada, o app envia a foto ao bucket e invoca uma Edge Function, como `analisar-imagem`. A função acessa o modelo de visão com a chave secreta e pode persistir a resposta. Essa função precisa ser implementada; não é um recurso que aparece automaticamente ao criar o bucket.

**Complemento de implementação:** a função deve autenticar a requisição e autorizar o acesso ao arquivo informado. Não confiar em qualquer `path` enviado pelo cliente. Falha de análise não deve apagar a foto ou o anúncio já salvo.

**Aplicação ao Enlace:** recurso opcional; não acrescentar IA, OCR, ML Kit ou Vision Camera sem necessidade explícita. Se existir, tratar a saída do modelo como resultado sujeito a erro, não como confirmação infalível sobre o animal.

**Verificar:** chave não aparece no app; usuário não consegue analisar arquivo privado de outro; tempo limite e erro possuem tratamento.

### MID-09 - Limpar temporários com segurança e mostrar progresso/erros

**Aula:** S3, p. 22. Mostrar andamento, tratar falta de rede/espaço e cancelamento, limpar cache e fornecer rótulos acessíveis.

**Complemento de implementação:** a limpeza deve distinguir temporários descartados, arquivos persistentes referenciados e pendências ainda não enviadas. Não remover a única cópia de uma mídia pendente. Para arquivos sem referência, considerar operações em andamento antes da coleta. Quotas precisam de uma regra compreensível de liberação de espaço.

**Verificar:** falta de espaço interrompe o salvamento sem falsa confirmação; cancelamento não remove mídias anteriores; limpeza preserva pendências; botões e mensagens de erro são compreensíveis.

## 5. Pontos de integração

O arquivo tratado entra no contrato de sincronização definido em [01](01-offline-first.md) e no upload descrito em [05](05-sqlite-supabase-e-seguranca.md). Para cada mídia, deve ser possível responder: onde está a cópia local, quem é seu dono, a qual anúncio pertence, qual etapa remota falta e o que acontece em uma nova tentativa.
