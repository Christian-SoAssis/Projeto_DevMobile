# 03 - Captura de foto, vídeo e QR Code

[Índice e convenções](README.md) · [Checklist](06-checklist-de-revisao.md)

## 1. Origem e objetivo

Fonte principal: **S2 - `02_Camera_ExpoCamera_Foto_Video_QR.pdf`**.

| Páginas | Conteúdo adaptado |
| --- | --- |
| 2-3 | ImagePicker versus câmera própria |
| 5-13 | CameraView, props, ref, fotografia e revisão |
| 15-17 | Gravação, limites, microfone e reprodução |
| 19-22 | QR, códigos de barras e repetição de leitura |
| 23-26 | Ciclo de vida, falhas comuns e atividade prática |

Objetivo: revisar os recursos de câmera que realmente existirem no Enlace. **Vídeo e QR não devem ser adicionados apenas porque fazem parte da aula.** Para uma funcionalidade fora do escopo, marcar os critérios correspondentes como não aplicáveis.

## 2. CameraView: configuração e ações

**Aula.** `CameraView` é o componente que mostra o preview ao vivo. Precisa de dimensões válidas, como `style={{ flex: 1 }}` dentro de um contêiner com espaço disponível.

As props configuram a câmera. Uma ref permite chamar métodos da instância.

| Prop do material | Papel |
| --- | --- |
| `facing`: `front` ou `back` | Escolher câmera frontal ou traseira |
| `flash`: `off`, `on` ou `auto` | Flash da fotografia |
| `enableTorch` | Iluminação contínua |
| `zoom`: de 0 a 1 | Controlar aproximação |
| `mode`: `picture` ou `video` | Selecionar tipo de captura |
| `videoQuality` | Qualidade/resolução do vídeo, conforme suporte |

Flash e lanterna contínua são recursos diferentes, mesmo que um exemplo associe ambos ao mesmo estado. O estado React pode controlar essas props, como alternar entre `front` e `back`.

Exemplo **didático**, não componente completo:

```tsx
const cameraRef = useRef<CameraView>(null);

// A chamada pressupõe permissão, câmera pronta e ausência de captura concorrente.
const foto = await cameraRef.current?.takePictureAsync({ quality: 0.7 });

// O componente precisa receber a mesma ref.
// <CameraView ref={cameraRef} style={{ flex: 1 }} />
```

`takePictureAsync()` retorna dados como URI, largura e altura. A aula apresenta `quality`, `base64`, `exif`, `skipProcessing` e `shutterSound` como opções. O suporte e os efeitos de cada opção devem ser conferidos por versão e plataforma. Ativar `skipProcessing` apenas por velocidade pode alterar resultados esperados de processamento; avaliar a saída real.

## 3. Captura e ciclo de vida

### CAP-01 - Montar a câmera apenas quando sua tela estiver em uso

**Aula:** S2, p. 23. O exemplo usa `useIsFocused()` para montar a câmera somente quando a tela está focada.

**Complemento de implementação:** foco da rota e estado foreground/background do app são condições distintas. Verificar o comportamento real ao navegar, bloquear o aparelho e voltar ao app, usando os mecanismos compatíveis com a navegação instalada.

**Verificar:** sair da tela não deixa câmera ou microfone capturando sem necessidade; voltar permite reabrir o preview.

### CAP-02 - Exigir permissão, layout e câmera pronta antes da ação

**Aula:** S2, pp. 6 e 23-24. `onCameraReady` indica prontidão; `onMountError` informa falhas. Ref não nula e permissão concedida são condições necessárias ao fluxo, mas não devem ser confundidas com prontidão completa.

**Verificar:** botões de captura ficam indisponíveis durante inicialização; erro de montagem produz feedback; ausência de espaço no layout não é diagnosticada automaticamente como falta de permissão.

### CAP-03 - Impedir capturas concorrentes e recuperar o estado após erro

**Aula:** S2, p. 10. Desabilitar o botão durante `takePictureAsync()`.

**Complemento de implementação:** usar `try/catch/finally` ou tratamento equivalente para liberar o estado de captura após exceção. Não criar registros para resultado ausente, nem deixar a tela presa em carregamento.

**Verificar:** tocar rapidamente várias vezes não cria capturas indevidas; uma falha permite nova tentativa.

### CAP-04 - Permitir revisar e confirmar a foto antes de persistir

**Aula:** S2, pp. 12-13. A tela alterna entre preview ao vivo e revisão da foto, com ações para refazer ou aceitar. Após aceitar, tratar/comprimir e salvar pelo fluxo de mídia.

**Aplicação ao Enlace:** a foto deve ser associada ao anúncio/rascunho correto. Refazer não deve publicar nem enfileirar uma imagem descartada.

**Complemento de implementação:** a limpeza do arquivo temporário deve respeitar se ele ainda está referenciado por outra etapa. Não apagar o arquivo escolhido apenas porque a tela da câmera desmontou.

**Verificar:** refazer, cancelar, aceitar e voltar preservam as mídias anteriores e não geram uploads fantasmas.

## 4. Vídeo, quando fizer parte do escopo

**Aula.** A mesma CameraView usa `mode="video"`. `useMicrophonePermissions()` trata o microfone para gravação com áudio.

| API/parâmetro | Semântica apresentada |
| --- | --- |
| `recordAsync()` | Inicia gravação; a Promise resolve quando ela termina |
| `stopRecording()` | Solicita encerramento da gravação |
| `maxDuration` | Limite em segundos |
| `maxFileSize` | Limite em bytes |
| `videoQuality` | Configuração no componente, como `720p` |
| `useVideoPlayer` e `VideoView` | Reprodução pelo `expo-video` |

Os valores 30 segundos, 20.000.000 bytes e 720p são exemplos de aula. Não transformá-los em limites do Enlace sem decisão de produto. A duração recebida em assets de ImagePicker pode estar em milissegundos; não confundir as unidades.

### CAP-05 - Controlar o estado da gravação e a permissão de áudio

**Aula:** S2, pp. 15-16. Solicitar microfone quando necessário e manter estado de gravação enquanto a Promise estiver pendente.

**Complemento de implementação:** não iniciar a segunda gravação durante a primeira; recuperar o estado em falhas; definir o que acontece ao sair da tela. Não afirmar que o áudio foi gravado se a permissão foi negada.

**Verificar:** gravar, parar, alcançar limites, negar áudio e sair da tela têm resultados previsíveis, sem captura oculta ou estado preso.

### CAP-06 - Revisar e reproduzir sem carregar o vídeo inteiro em listas

**Aula:** S2, p. 17; S3, pp. 14-15. O player permite rever o vídeo; miniaturas evitam carregamento pesado em listagens.

**Complemento de implementação:** tratar arquivo indisponível e interromper reprodução quando não for necessária, conforme o ciclo de vida da biblioteca utilizada. Gravação, reprodução e upload são etapas separadas.

**Verificar:** o vídeo gravado pode ser revisto e descartado; a lista utiliza sua capa quando essa estratégia estiver adotada. Upload resumível e persistência estão no documento 04.

## 5. QR Code e códigos de barras, quando aplicáveis

**Aula.** O scanner da CameraView utiliza `barcodeScannerSettings` e `onBarcodeScanned`. O evento fornece `type` e `data`.

| Família citada | Exemplos de uso na aula |
| --- | --- |
| `qr` | Links, Pix, ingressos |
| `ean13`, `ean8` | Produtos |
| `code128`, `code39` | Logística e estoque |
| `pdf417`, `datamatrix` | Documentos e etiquetas |

Um scanner reconhece conteúdo; ele não valida automaticamente um ingresso, efetua pagamento nem autentica alguém. Essas ações exigem lógica própria.

### CAP-07 - Restringir tipos e evitar leitura repetida

**Aula:** S2, pp. 19-21. Selecionar apenas os tipos necessários e usar um estado para pausar o callback após a leitura.

```tsx
// Exemplo didático da aula: reativar lido somente para uma nova leitura.
onBarcodeScanned={lido ? undefined : ({ data }) => {
  setLido(true);
  tratarLeitura(data);
}}
```

**Complemento de implementação:** callbacks podem chegar antes da próxima renderização. Se o resultado dispara uma operação importante, adicionar proteção síncrona ou deduplicação na ação, além do estado visual. Ler novamente deve ser uma ação controlada.

**Verificar:** manter o código diante da câmera não dispara repetidamente navegação, gravação ou requisições.

### CAP-08 - Validar o conteúdo antes de executar uma ação

**Complemento de implementação a S2, pp. 19-22.** Tratar `data` como entrada externa: verificar formato, tamanho e destino permitido. Não abrir automaticamente qualquer URL nem executar uma ação privilegiada apenas porque o QR foi lido.

**Aplicação ao Enlace:** se o recurso existir, documentar o significado do código, por exemplo um identificador de anúncio, e como resolver códigos inválidos ou referentes a registros indisponíveis.

**Verificar:** código malformado e código válido de outro contexto produzem mensagem segura e permitem tentar novamente.

## 6. Diagnóstico rápido

| Sintoma do material | Verificação inicial |
| --- | --- |
| Tela preta | Layout/dimensões, permissão, disponibilidade da câmera e erro de montagem |
| Botão sem efeito | Permissão, ref, prontidão e estado de captura |
| Vídeo sem áudio | Permissão de microfone e configuração do modo |
| QR repetido | Callback ativo e ausência de deduplicação |
| Bateria consumida fora da tela | Montagem, foco e estado do aplicativo |

Essas são hipóteses de diagnóstico, não conclusões automáticas. Registrar a causa observada e o dispositivo/build usado na validação.
