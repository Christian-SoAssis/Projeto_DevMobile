# Enlace - Regras obrigatórias para especificação e construção da UI

## 1. Missão do agente

Produza um guia técnico completo para implementar a interface do Enlace a partir das duas pranchas geradas para o redesign do Enlace, das documentações principais e do código disponíveis na pasta de trabalho do projeto.

**Entregável esperado:** `docs/ui/docs/refatoracao_ui.md`.

Este arquivo contém as instruções para elaborar esse guia. Ele não substitui a inspeção do repositório, o inventário de assets nem a especificação de cada tela.

Nesta etapa, inspecione o projeto e escreva a documentação. A implementação do redesign deve ocorrer quando solicitada pelo usuário. Se houver um guia no caminho de destino, integre as alterações e preserve decisões válidas já registradas.

## 2. Vocabulário normativo

- **DEVE:** obrigação verificável.
- **NÃO DEVE:** proibição.
- **PODE:** alternativa permitida, desde que a escolha seja registrada.
- **REFERÊNCIA:** informação observada em imagem, arquivo ou requisito fornecido.
- **DECISÃO DE IMPLEMENTAÇÃO:** escolha técnica necessária para concretizar a referência; não deve ser apresentada como medida extraída da imagem.
- **PENDÊNCIA:** informação que ainda não foi confirmada. Deve indicar impacto e o que falta verificar.

Uma obrigação condicional aplica-se somente quando a condição existir. Recursos ausentes do escopo devem ser marcados como `não aplicáveis`, com justificativa.

## 3. Entradas e responsabilidade de cada fonte

O agente DEVE localizar e registrar os caminhos reais das entradas abaixo. NÃO DEVE inventar caminhos ou afirmar que leu um arquivo indisponível.

| Entrada | Uso obrigatório |
| --- | --- |
| Duas pranchas geradas para o redesign, com a logo corrigida | Composição visual, hierarquia, componentes e direção claymorphism |
| Asset da logo disponível no projeto, se presente | Conferir forma, proporção, cores e contorno contínuo com as pranchas geradas |
| Código atual do projeto | Rotas, componentes, dados, permissões e comportamentos existentes |
| Requisitos e instruções do repositório | Escopo e restrições funcionais e técnicas |
| Documentação em `docs/arquitetura/`, se presente | Contratos de persistência, mídia, autenticação e sincronização |

O agente já está trabalhando dentro do repositório. DEVE usar a pasta de trabalho atual para inspecionar código, assets e documentação. As referências visuais deste documento são exclusivamente as duas pranchas geradas para o redesign do Enlace, disponibilizadas ao agente:

- Prancha 01/02 (V01–V08): `docs/ui/images/Painel Enlace com logos de pets-2.png`
- Prancha 02/02 (V09–V16): `docs/ui/images/Reparo do emblema Enlace em telas móveis-1.png`

Observação: o número no nome do arquivo NÃO corresponde à numeração interna (o arquivo sufixado `-2` contém a prancha 01/02 e o `-1` contém 02/02); a identificação é pelo conteúdo. Cores e tipografia têm sua base explícita na regra UI-03.

### Resolução de divergências

1. Instruções explícitas do usuário definem o escopo da tarefa.
2. Requisitos funcionais e de autorização não podem ser removidos para imitar um recorte visual.
3. As duas pranchas geradas definem a direção visual desejada, em conjunto com a identidade descrita neste arquivo. As documentações principais anteriores do projeto prevalecem sobre este arquivo em requisitos, regras de negócio, segurança e arquitetura.
4. O código informa o estado implementado, mas não transforma automaticamente um defeito em requisito.
5. Em divergências entre requisitos e código, registrar ambos e o impacto; NÃO DEVE alterar silenciosamente a regra de negócio.
6. Para medidas ausentes nas imagens, o agente DEVE escolher valores consistentes e identificá-los como decisões de implementação.

As pranchas corrigidas foram produzidas por edição generativa e podem conter pequenas variações entre versões das próprias pranchas geradas. A correção solicitada foi no contorno da logo. O agente NÃO DEVE interpretar diferenças incidentais em fotos, textos ou espaçamentos como autorização para outra mudança de design.

### Revisão obrigatória deste arquivo antes de produzir o guia

O agente DEVE revisar e corrigir este próprio arquivo antes de usá-lo como base para o guia de implementação:

1. Localizar e ler as documentações principais anteriores disponíveis no projeto: instruções para agentes, README, requisitos, regras de negócio, decisões arquiteturais e documentos de persistência, câmera, mídia, segurança e sincronização. Registrar somente os caminhos realmente encontrados.
2. Comparar as regras deste arquivo com essas fontes, incluindo inventário de telas, papéis, acesso, contratos de dados e comportamentos offline. NÃO DEVE considerar uma afirmação deste arquivo confirmada apenas porque está escrita como obrigação.
3. Corrigir diretamente neste arquivo os pontos que contrariem requisitos ou decisões estabelecidas nas documentações principais. Ajustar também tabelas, critérios de aceite e etapas relacionadas para manter a consistência interna.
4. Preservar a direção visual solicitada e distinguir decisões visuais novas de requisitos já existentes. NÃO DEVE alterar as documentações principais apenas para fazê-las concordar com este arquivo.
5. Registrar no guia cada correção relevante: seção/regra alterada, divergência identificada, decisão aplicada e caminho/seção da documentação que a fundamenta.
6. Quando as próprias fontes principais forem contraditórias e não houver uma decisão vigente identificável, registrar a ambiguidade e seu impacto. Solicitar esclarecimento apenas para a decisão afetada e continuar o trabalho independente dela.

Esta revisão autoriza a correção documental das divergências comprovadas; não autoriza alterar regras de negócio ou implementar o redesign nesta etapa. O agente DEVE entregar a versão revisada deste arquivo junto com o guia.

## 4. Regras inegociáveis

### UI-01 - Registrar referências e evidências

- O guia DEVE identificar cada referência por arquivo, versão disponível e finalidade.
- A inspeção do código DEVE registrar o commit ou estado de trabalho utilizado.
- Toda afirmação sobre uma rota, componente ou comportamento existente DEVE apontar para evidência no projeto.
- Ausência de acesso DEVE ser registrada como `não verificado`; NÃO DEVE ser tratada como ausência da funcionalidade.

**Aceitação:** o leitor consegue distinguir referências observadas, decisões propostas e pendências sem consultar esta conversa.

### UI-02 - Preservar a logo e a identidade visual

- A logo DEVE conservar o cachorro branco, o gato laranja e a composição original com contorno marrom contínuo.
- O contorno externo na região posterior do gato DEVE ser contínuo, sem abertura ou interrupção.
- A implementação DEVE usar um único asset canônico da logo e um componente compartilhado para exibi-lo.
- O agente NÃO DEVE redesenhar a logo por tela, substituí-la por ícone de pata, deformar sua proporção, recortar o contorno ou modificar suas cores.
- O guia DEVE definir dimensões por variante, proporção, área livre e comportamento de redimensionamento.
- Se o asset isolado e corrigido ainda não existir, o agente DEVE registrar essa dependência. Uma miniatura recortada de uma prancha NÃO DEVE ser declarada asset final de marca sem verificar resolução e integridade.
- Nota de inspeção (06/11/2026): o asset isolado da logo NÃO existe no repositório (pasta `assets/` inexistente). O guia DEVE registrar essa PENDÊNCIA com ação de entrega e fallback textual da marca enquanto o asset não for fornecido.

**Aceitação:** todas as ocorrências usam o mesmo asset, sem distorção, corte ou falha de contorno.

### UI-03 - Definir cores e tipografia explicitamente

Paleta de referência identificada para o redesign:

| Cor | Valor de referência | Papel inicial |
| --- | --- | --- |
| Marfim | `#FDF7F0` | Fundo |
| Creme | `#FDF1E6` | Superfícies |
| Pêssego | `#F6D3BC` | Apoio visual e sombras quentes |
| Terracota | `#C2512E` | Ação principal e identidade |
| Laranja | `#D9643A` | Destaques |
| Marrom escuro | `#3A1F14` | Texto principal |
| Marrom | `#5C4033` | Texto secundário |
| Verde | `#2F6B42` | Sucesso e disponibilidade |

- O guia DEVE definir tokens semânticos para fundo, superfície, texto, borda, ação, foco, sucesso, alerta e erro, com valores concretos.
- Os papéis acima são uma base; o agente DEVE verificar o contraste de cada combinação efetivamente usada.
- Base tipográfica definida neste documento: **Arial Black** para títulos e marca textual; **DejaVu Sans** para texto corrente.
- O agente DEVE verificar quais arquivos de fonte estão disponíveis e especificar carregamento, pesos, tamanhos, alturas de linha e fallback.
- O agente NÃO DEVE assumir que declarar o nome da fonte garante sua disponibilidade em Android e iOS.
- Qualquer substituição DEVE ser identificada e justificada; NÃO DEVE ser apresentada como a fonte especificada acima quando for diferente.
- Nota de inspeção (06/11/2026): não há arquivos de fonte nem a pasta `assets/` no repositório. Enquanto os arquivos não forem entregues, usar fallback tipográfico do sistema (pesos e `letterSpacing` explícitos) e manter a entrega das fontes como PENDÊNCIA.

**Aceitação:** nenhuma definição final depende apenas de expressões como “laranja parecido”, “fonte arredondada” ou “texto grande”.

### UI-04 - Especificar o claymorphism como propriedades implementáveis

- O tratamento DEVE usar superfícies cremosas, cartões com volume suave, campos discretamente rebaixados e botões terracota elevados.
- O guia DEVE especificar raio, borda, preenchimento, direção da luz, cor/opacidade/deslocamento/desfoque da sombra e estado pressionado de cada família de componentes.
- A solução DEVE ser compatível com as versões instaladas e ter comportamento definido nas plataformas-alvo.
- O agente NÃO DEVE trocar a direção por glassmorphism, brilho neon, tema azul/roxo ou superfícies sem contraste com o fundo.
- O relevo NÃO DEVE ser o único indicador de interatividade, foco ou seleção.

**Aceitação:** botões, campos e cartões mantêm o mesmo tratamento entre telas e continuam distinguíveis sem depender apenas das sombras.

### UI-05 - Centralizar tokens e componentes

- O guia DEVE definir uma escala de espaçamento e tokens de cores, tipografia, raios, bordas, sombras e dimensões recorrentes.
- O agente DEVE mapear componentes existentes antes de propor novos.
- A especificação DEVE cobrir, quando aplicáveis: botão, campo, cartão de animal, chip, badge de status, cabeçalho, navegação, aviso offline, folha de filtros e estados vazio/erro/carregamento.
- Cada componente DEVE ter responsabilidade, variantes, dados de entrada, eventos, estados e regras de acessibilidade documentados.
- A implementação NÃO DEVE duplicar estilos equivalentes por tela ou criar abstrações sem uso demonstrado.

**Aceitação:** uma alteração de token ou componente compartilhado pode ser propagada sem editar manualmente todas as telas.

### UI-06 - Mapear telas, rotas e variantes sem inventar navegação

O inventário visual de referência possui 16 visualizações, correspondentes a 12 telas na inspeção anterior. Reinspeção de 06/11/2026: 16 arquivos em `app/` — 13 rotas (12 telas + 1 redirect raiz `app/index.tsx` → `/(tabs)`) + 3 layouts (`_layout` raiz, `(tabs)/_layout`, `(protected)/_layout`). O agente DEVE revalidar o código atual; esses números não são uma restrição para mudanças posteriores legítimas do projeto.

| Identificador | Visualização | Classificação a verificar |
| --- | --- | --- |
| V01 | Entrar | Tela de autenticação |
| V02 | Criar conta | Tela de cadastro |
| V03 | Explorar: lista | Variante da busca |
| V04 | Explorar: mapa | Variante da busca |
| V05 | Filtros da busca | Painel/estado da busca |
| V06 | Detalhes: adoção | Variante para quem consulta o anúncio |
| V07 | Favoritos | Tela de favoritos |
| V08 | Conta: visitante | Estado não autenticado da conta |
| V09 | Meus anúncios | Tela de gestão dos próprios anúncios |
| V10 | Novo anúncio | Formulário de criação |
| V11 | Editar anúncio | Formulário de edição |
| V12 | Conta: perfil | Estado autenticado da conta |
| V13 | Sincronização | Tela de pendências e envio |
| V14 | Revisar alterações | Tela de resolução de conflitos |
| V15 | Moderação | Tela restrita ao administrador |
| V16 | Detalhes: responsável | Variante para o dono do anúncio |

- O guia DEVE associar cada identificador à rota e ao componente reais, informando onde há compartilhamento.
- Uma variante visual NÃO DEVE virar uma nova rota sem necessidade de navegação demonstrada.
- Fluxos nativos, como câmera ou seletor do sistema, NÃO DEVEM ser apresentados como telas próprias já existentes sem evidência.
- Verificado (06/11/2026): câmera/galeria são gatilhos `ImagePicker` via `src/infrastructure/device/camera/ImagePickerCameraAdapter.ts`, não telas próprias.

**Aceitação:** todas as visualizações e todas as rotas relevantes do inventário atual estão mapeadas, inclusive diferenças em relação às pranchas.

### UI-07 - Preservar comportamentos e dados

- O redesign DEVE preservar autenticação, busca, filtros, favoritos, interesse em adoção, gestão de anúncios, mídia, localização, sincronização e moderação que estejam no escopo vigente.
- Campos e ações ausentes no recorte de um mockup NÃO DEVEM ser removidos automaticamente.
- O guia DEVE identificar a origem dos dados e o caso de uso/evento associado a cada ação.
- O agente NÃO DEVE acrescentar chat, pagamento, matching, login social ou outra funcionalidade apenas para preencher espaço visual.

**Aceitação:** existe correspondência verificável entre os comportamentos anteriores e os previstos após o redesign; qualquer alteração de comportamento está explicitamente registrada.

### UI-08 - Respeitar papéis e privacidade

- Controles DEVERÃO seguir as regras reais de visitante, usuário autenticado, responsável e administrador, conforme áreas (PUBLIC/AUTHENTICATED/ADMIN) e papéis (VISITOR/USER/RESPONSIBLE/INTERESTED/ADMIN) de `src/domain/services/AccessPolicy.ts`; `RESPONSIBLE` e `INTERESTED` são especializações do usuário autenticado, não barreiras de acesso.
- Ações de gestão do anúncio DEVERÃO estar vinculadas ao usuário autorizado; moderação DEVERÁ permanecer restrita ao administrador.
- Contatos de interessados NÃO DEVEM aparecer na visualização pública quando destinados ao responsável.
- A localização pública DEVE respeitar o contrato de localização aproximada do Enlace.
- Ocultar um controle NÃO DEVE substituir autorização existente na aplicação ou no backend.

**Aceitação:** o guia possui uma matriz de visibilidade e ações por papel, consistente com os requisitos e com as verificações de acesso do projeto.

### UI-09 - Especificar estados e transições

- Componentes e telas DEVEM documentar, quando aplicáveis: padrão, pressionado, focado, selecionado, desabilitado, carregando, vazio, erro e sucesso.
- Fluxos de mídia DEVEM incluir cancelamento e permissão negada.
- Fluxos offline DEVEM distinguir salvo no aparelho, aguardando envio, sincronizando, sincronizado, falha e necessidade de revisão.
- A UI NÃO DEVE mostrar “sincronizado”, “enviado” ou “publicado” antes da confirmação correspondente do sistema.
- O guia DEVE definir gatilho, mensagem, ação disponível e saída de cada estado.
- Mensagens de produto NÃO DEVEM expor UUIDs, nomes de tabelas ou erros internos quando esses detalhes não ajudam o usuário a decidir.

**Aceitação:** estados não felizes possuem especificação própria e podem ser reproduzidos para validação.

### UI-10 - Implementar componentes reais e conteúdo dinâmico

- Campos, botões, textos, listas e navegação DEVEM ser componentes funcionais.
- O agente NÃO DEVE usar a prancha como fundo de uma tela nem simular a interface com regiões clicáveis sobre uma captura.
- Nomes, contagens, contatos e fotografias de exemplo DEVEM ser identificados como dados ilustrativos; a implementação DEVE receber os dados reais do app.
- Fotografias de anúncios DEVEM representar os animais cadastrados. Ilustrações decorativas NÃO DEVEM substituir essas fotos como se fossem o animal anunciado.

**Aceitação:** mudanças nos dados reais são refletidas pela UI; os controles executam ações reais e não respostas fixas de demonstração.

### UI-11 - Definir adaptação e acessibilidade

- O guia DEVE especificar áreas seguras, teclado aberto, rolagem, telas pequenas, textos longos e aumento de fonte.
- Layouts DEVEM usar o espaço disponível; posicionamento absoluto fica limitado a sobreposições justificadas, não à organização principal das telas.
- Como metas deste projeto, áreas interativas DEVEM ter pelo menos 48 × 48 unidades lógicas de toque e texto corrente DEVE atingir contraste mínimo de 4,5:1 com seu fundo efetivo.
- O contraste DEVE ser avaliado nos pares reais de cores, incluindo botões, avisos e texto sobre imagens.
- Elementos DEVEM ter rótulos, papéis e estados acessíveis adequados; informação de erro, seleção e status NÃO DEVE depender apenas de cor.
- A redução de movimento DEVE ser respeitada quando houver animações decorativas.

**Aceitação:** teclado e aumento de fonte não ocultam permanentemente ações essenciais; estados continuam compreensíveis com leitor de tela e sem percepção de cor.

### UI-12 - Preservar a separação arquitetural

- Componentes visuais DEVEM consumir os contratos existentes de aplicação e apresentação.
- O redesign NÃO DEVE introduzir consultas ao banco, sincronização, upload ou autorização dentro de componentes puramente visuais.
- Dependências existentes DEVEM ser avaliadas antes de propor outra biblioteca.
- Mudanças necessárias em navegação, dados ou contratos DEVEM ser separadas das mudanças de estilo e justificadas.
- Alterações de UI NÃO DEVEM apagar banco, pendências ou arquivos do usuário.

**Aceitação:** a responsabilidade de cada alteração está explícita e os fluxos de dados continuam identificáveis.

### UI-13 - Controlar custo de imagens, sombras e animações

- O guia DEVE definir dimensões/aspect ratio, modo de encaixe, placeholder, falha de carregamento e estratégia de miniaturas para mídia.
- Listas extensas DEVEM usar renderização adequada ao volume real e não carregar indiscriminadamente originais grandes.
- Efeitos claymorphism DEVEM ser reutilizáveis e testados nas plataformas-alvo.
- O agente NÃO DEVE declarar desempenho adequado sem execução ou medição; resultados não observados DEVEM ficar como pendência de validação.
- O guia DEVE fixar o cenário e o orçamento numérico adotado para avaliar carregamento/rolagem, identificando-os como decisões de implementação. Orçamento registrado no guia (DECISÃO): lista com ~50 anúncios, foto 4:3 com lado maior ≤ 1280px em `thumbnail`, alvo de rolagem 60fps (FlatList `windowSize 7`); a medição em aparelho físico permanece pendente (ordem 8).

**Aceitação:** o plano de validação de desempenho informa aparelho/ambiente, volume de dados, métrica, limite esperado e resultado a registrar.

### UI-14 - Validar visualmente e funcionalmente

- A implementação DEVE ser comparada com a referência em viewport equivalente.
- A comparação DEVE avaliar composição, hierarquia, tipografia, cores, espaçamento, dimensões, logo, fotos e estados.
- O agente DEVE registrar diferenças intencionais e sua justificativa.
- Compilação ou typecheck bem-sucedidos NÃO DEVEM ser apresentados como prova de fidelidade visual ou funcionamento em aparelho.
- A verificação funcional DEVE cobrir os fluxos e estados afetados, com testes proporcionais ao risco e execução manual quando necessária.
- O agente NÃO DEVE afirmar que executou testes, validou plataformas ou conferiu telas sem evidência correspondente.

**Aceitação:** o relatório distingue verificações executadas, resultados observados, diferenças justificadas e verificações pendentes.

## 5. Estrutura obrigatória do guia a produzir

O arquivo `docs/ui/docs/refatoracao_ui.md` DEVE conter:

1. Escopo, referências e versão do código inspecionado.
2. Inventário de telas, rotas, variantes e papéis.
3. Inventário de assets e fontes, com caminhos reais e pendências.
4. Tokens visuais com valores, unidades, papéis e origem da decisão.
5. Catálogo de componentes reutilizáveis e respectivos estados.
6. Especificação individual de cada tela/variante.
7. Navegação e matriz de visibilidade por papel.
8. Estados de formulário, mídia, conexão e sincronização.
9. Regras de adaptação, acessibilidade e desempenho.
10. Plano incremental de implementação, com dependências e arquivos afetados.
11. Plano de validação visual e funcional, com critérios de aceite.
12. Registro de decisões, divergências, correções deste arquivo e pendências, com as fontes locais que fundamentam cada correção.

### Modelo obrigatório por tela ou variante

| Campo | Conteúdo exigido |
| --- | --- |
| Identificador | Código estável, como `V03` |
| Referência visual | Prancha e posição da tela |
| Rota e componente | Caminhos reais verificados |
| Papel e acesso | Quem pode abrir e quais ações pode executar |
| Objetivo | Tarefa que o usuário realiza |
| Composição | Elementos em ordem de leitura e agrupamentos |
| Componentes | Componentes compartilhados e variantes usadas |
| Dimensões | Valores ou regras de cálculo para espaçamento, altura, largura, tipografia e raios |
| Conteúdo e dados | Texto estático, dados dinâmicos e origem de cada informação |
| Interações | Gatilho, ação/caso de uso, navegação e resultado esperado |
| Estados | Condição de entrada, aparência, mensagem, ação e saída |
| Adaptação | Teclado, rolagem, largura pequena, texto longo e fonte ampliada |
| Acessibilidade | Rótulos, ordem de leitura, toque, foco e informação de estado |
| Critérios de aceite | Verificações objetivas específicas da tela |
| Pendências | Dependências não confirmadas e impacto na implementação |

O guia DEVE evitar expressões sem especificação associada, como “espaçamento agradável”, “sombra suave” ou “parecido com a imagem”. Descrições estéticas podem contextualizar; não substituem valores e regras.

## 6. Procedimento de execução

1. Ler as instruções e documentações principais anteriores do repositório; localizar as duas pranchas geradas. Revisar e corrigir este arquivo conforme a seção 3, registrando as fontes e as alterações antes de produzir o guia.
2. Inspecionar rotas, componentes, estilos, assets, fontes, dependências e contratos de dados.
3. Revalidar o inventário de visualizações e identificar diferenças em relação ao código atual.
4. Registrar quais elementos vêm da referência e quais exigem uma decisão técnica.
5. Definir tokens e componentes compartilhados.
6. Especificar cada tela, seus estados, papéis e interações.
7. Definir implementação incremental: base visual, componentes, telas e validação.
8. Revisar o guia contra UI-01 a UI-14 na versão reconciliada deste arquivo e contra as documentações principais do projeto.
9. Entregar este arquivo revisado e o guia; informar correções relevantes, suas fontes e pendências concretas.

O agente DEVE resolver escolhas rotineiras de implementação e documentá-las. Somente ambiguidades que alterem escopo, identidade ou comportamento exigem uma decisão adicional do usuário. A falta de uma medida no mockup, isoladamente, não é motivo para interromper a documentação.

## 7. Critério de conclusão da documentação

A documentação está completa quando:

- [x] Este arquivo foi comparado com as documentações principais anteriores do projeto e as divergências comprovadas foram corrigidas.
- [x] As correções possuem justificativa e referência à documentação local correspondente.
- [x] As referências visuais se limitam às duas pranchas geradas para o redesign.
- [x] Todas as referências disponíveis foram identificadas e as ausentes estão registradas.
- [x] Todas as rotas e variantes relevantes do inventário atual foram mapeadas.
- [x] A logo canônica e a disponibilidade das fontes estão identificadas ou registradas como dependências concretas.
- [x] Tokens possuem valores e unidades; decisões estimadas estão rotuladas.
- [x] Componentes têm variantes, estados e contratos documentados.
- [x] Cada tela possui os campos exigidos no modelo da seção 5.
- [x] Papéis, privacidade, offline e preservação de funcionalidades foram considerados.
- [x] Existe plano incremental e plano de validação com critérios verificáveis.
- [x] Nenhuma execução de teste ou implementação foi declarada sem ter ocorrido.
- [x] Pendências que impedem implementar uma parte estão explicitamente identificadas.

**Regra final:** quando uma referência não fornecer uma medida, comportamento ou decisão, registrar uma escolha explícita e consistente ou uma pendência concreta. Nunca inventar silenciosamente nem apresentar uma suposição como requisito existente.

### Revisão registrada (06/11/2026)

Este arquivo foi revisado conforme a revisão obrigatória da seção 3. Correções aplicadas: caminho do entregável (§1 e §5), caminhos/nomeação das pranchas (§3), assets logo e fontes inexistentes (UI-02/UI-03), contagem `app/` = 16 arquivos: 13 rotas + 3 layouts (UI-06), câmera/galeria como gatilhos `ImagePicker` (UI-06), papéis conforme `AccessPolicy.ts` (UI-08) e orçamento numérico de desempenho (UI-13). Comentário/detalhamento completo em `docs/ui/docs/refatoracao_ui.md` §12.1 (guia commitado como `a33c9de`).
