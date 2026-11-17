# 02 - Câmera, permissões e seleção de mídia

[Índice e convenções](README.md) · [Checklist](06-checklist-de-revisao.md)

## 1. Origem e objetivo

Fonte principal: **S1 - `01_Camera_Fundamentos_Permissoes_ImagePicker.pdf`**.

| Páginas | Conteúdo adaptado |
| --- | --- |
| 3-5 | Objetivos, usos da câmera e responsabilidades dos pacotes |
| 7-12 | Permissões, hooks, configurações e declaração no app |
| 14-18 | ImagePicker, captura nativa, assets e seleção múltipla |
| 19-21 | Exibição, atividade de avatar e síntese |

Objetivo: orientar a revisão da entrada de mídia e das permissões, incluindo cancelamento e negação, sem confundir seleção, captura e persistência.

## 2. Responsabilidades das bibliotecas

**Aula.** O ecossistema apresentado separa responsabilidades:

| Biblioteca | Papel | Não confundir com |
| --- | --- | --- |
| `expo-image-picker` | Abrir seletor de mídia ou câmera do sistema | Uma câmera própria montada na tela |
| `expo-camera` | Preview integrado, captura, vídeo e códigos | Um seletor de galeria |
| `expo-image-manipulator` | Transformar e comprimir imagens | Persistência de metadados |
| `expo-media-library` | Salvar/listar mídia na galeria do usuário | Armazenamento interno obrigatório de todo rascunho |
| `expo-video` | Reprodução de vídeos | Captura de vídeo |
| `expo-sqlite` | Dados e referências locais | Repositório recomendado para os bytes de imagens |

No Enlace, selecionar uma foto existente e tirar uma foto são caminhos de entrada diferentes. Depois da obtenção de uma URI, ambos podem compartilhar o tratamento descrito no [documento 04](04-tratamento-e-armazenamento-de-midia.md).

## 3. Modelo de permissões

**Aula.** Declarar o recurso na configuração nativa e solicitar autorização em execução são etapas diferentes. O usuário deve entender por que a permissão é necessária, preferencialmente quando acionar a funcionalidade.

Exemplo didático do hook:

```tsx
const [permissao, pedirPermissao] = useCameraPermissions();
```

| Estado | Significado | Resposta da interface |
| --- | --- | --- |
| Objeto `null` | O hook ainda está carregando o estado | Aguardar; não assumir concessão |
| Indeterminado | Usuário ainda não decidiu | Explicar e solicitar no contexto |
| `granted === true` | Acesso concedido | Habilitar o recurso |
| Negado, `canAskAgain === true` | Pode haver nova solicitação | Mostrar alternativa e permitir nova tentativa |
| Negado, `canAskAgain === false` | Novo diálogo não pode ser solicitado por esse fluxo | Orientar o usuário às configurações |

O estado de carregamento não é o mesmo que “ainda não perguntamos”. O método `Linking.openSettings()` abre as configurações do aplicativo, mas não concede permissão por conta própria.

Os slides configuram mensagens de câmera e microfone pelo plugin `expo-camera` em `app.json`, incluindo `recordAudioAndroid`. No Expo Go, o texto pertence ao Expo Go; a configuração personalizada precisa ser validada no build do app. As permissões exatas para galeria e mídia variam por plataforma, versão e fluxo; não copiar pedidos de acesso amplo sem verificar sua necessidade.

## 4. Seleção e captura com ImagePicker

| Método da aula | Finalidade |
| --- | --- |
| `launchImageLibraryAsync()` | Abrir o seletor nativo de arquivos de mídia |
| `requestCameraPermissionsAsync()` | Solicitar acesso à câmera para o fluxo nativo |
| `launchCameraAsync()` | Abrir a captura pela interface do sistema |

Exemplo **didático**, a adaptar às versões instaladas e ao fluxo do projeto:

```tsx
const resultado = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
});

if (!resultado.canceled && resultado.assets?.length) {
  const selecionada = resultado.assets[0];
  // Encaminhar selecionada ao fluxo de tratamento e persistência.
}
```

O recorte quadrado é adequado ao exercício de avatar, não uma exigência para fotos de animais. `quality` não estabelece por si só um limite de bytes para upload.

### O resultado recebido

| Campo do asset | Conteúdo |
| --- | --- |
| `uri` | Referência ao arquivo retornado |
| `width`, `height` | Dimensões em pixels |
| `type` | Tipo de mídia retornado |
| `fileName`, `fileSize` | Nome e tamanho, quando disponíveis |
| `duration` | Duração do vídeo em milissegundos, quando disponível |
| `exif`, `base64` | Informações opcionais solicitadas nas opções |

Não depender da presença de todos os metadados. A URI retornada pode apontar para um arquivo temporário; obter a URI não comprova que o arquivo sobreviverá à limpeza do cache.

A seleção múltipla usa `allowsMultipleSelection` e pode limitar a quantidade com `selectionLimit`. Ela não deve ser combinada com `allowsEditing` no fluxo apresentado. Se vídeo for parte do escopo, conferir os limites efetivos da plataforma: não presumir que escolher um arquivo existente o recorta automaticamente.

## 5. Regras verificáveis

### PER-01 - Solicitar a permissão necessária no contexto correto

**Aula:** S1, pp. 7-12. Usar câmera somente após autorização. **Aplicação ao Enlace:** pedir acesso quando o usuário escolher fotografar, com uma mensagem relacionada à foto do anúncio.

Não bloquear o restante do aplicativo apenas porque a câmera foi negada. Uma alternativa de galeria pode permanecer disponível se fizer parte do produto e tiver acesso permitido.

**Verificar:** instalação nova, primeira tentativa de captura e negação não produzem tela quebrada nem loop de solicitações.

### PER-02 - Tratar carregamento, negação e retorno das configurações

**Aula:** S1, pp. 8-11. Diferenciar carregamento, concessão, negação e impossibilidade de perguntar novamente.

**Complemento de implementação:** após voltar das configurações, reavaliar a permissão conforme a API utilizada. Não presumir que abrir as configurações mudou o estado. O mesmo vale para uma permissão revogada fora do app.

**Verificar:** negar permanentemente, abrir configurações, conceder e voltar; o fluxo deve refletir o novo estado sem exigir perda do formulário.

### PER-03 - Conferir a configuração nativa e o ambiente de teste

**Aula:** S1, p. 12. Mensagens e permissões declaradas no projeto devem corresponder às funcionalidades utilizadas.

**Verificar:** comparar configuração Expo com as chamadas reais; registrar em qual plataforma e build o fluxo foi testado. Um sucesso no Expo Go não comprova a personalização das mensagens no aplicativo distribuído.

### PER-04 - Escolher a entrada de mídia pelo requisito

**Aula:** S1, pp. 14-16; S2, pp. 2-3. ImagePicker é adequado à interface nativa; CameraView é adequada à câmera incorporada, controles próprios e leitura de códigos.

**Aplicação ao Enlace:** mapear qual biblioteca implementa cada ação existente. Não substituir um fluxo funcional só por preferência, nem remover câmera própria se ela for um requisito da disciplina.

**Verificar:** botões “galeria” e “câmera”, quando existentes, executam a ação anunciada e tratam as permissões correspondentes.

### PER-05 - Tratar cancelamento e validar o resultado antes de utilizá-lo

**Aula:** S1, pp. 15-18. Verificar `canceled` antes de acessar `assets`.

**Complemento de implementação:** conferir se há asset e URI utilizável, se o tipo é aceito e se o tamanho/quantidade respeita o contrato do app. Tratar erro de leitura e metadados ausentes. Cancelamento normal não deve aparecer como falha técnica.

**Verificar:** cancelar preserva a foto anterior e o formulário; não cria registro vazio, exceção nem operação pendente.

### PER-06 - Respeitar os limites e as combinações de seleção

**Aula:** S1, p. 18. Configurar os tipos permitidos, a seleção múltipla e seus limites, sem combinar edição incompatível.

**Aplicação ao Enlace:** a quantidade de fotos por anúncio é decisão do produto, não o número cinco do exemplo. Validar também antes de persistir/enviar; configuração do seletor não substitui a validação remota.

**Verificar:** selecionar várias mídias, alcançar o limite e tentar um tipo não aceito não corrompe a lista de fotos.

### PER-07 - Separar pré-visualização de persistência

**Aula:** S1, pp. 17-19; S4, p. 23. Uma URI exibida em `<Image>` ainda pode ser temporária. `expo-image` facilita exibição e cache, mas seu cache não é garantia de conservação de um rascunho.

**Aplicação ao Enlace:** aceitar a mídia deve encaminhá-la ao tratamento e armazenamento persistente, preservando uma pré-visualização coerente. Ver MID-02 e MID-03.

**Verificar:** exibir a imagem com dimensões definidas e tratamento de falha; salvar, encerrar e reabrir mantém a referência válida ao arquivo.

## 6. Critérios de experiência de uso

O exercício de avatar da aula combina galeria, câmera, recorte e exibição circular. Para o Enlace, aproveitar os princípios sem obrigar esse formato em anúncios.

O usuário deve saber se está escolhendo, revisando ou salvando a foto. Botões devem ter rótulos claros e ações de cancelar não devem apagar trabalho já salvo. O pós-processamento e o upload pertencem a etapas posteriores, não ao significado de “seleção concluída”.
