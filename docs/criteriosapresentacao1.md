Planejamento Completo: Fase "Domínio e Interface Primeiro" (100% Mock / 80%+ Cobertura)
Nesta etapa inicial, o desenvolvimento segue um fluxo estritamente incremental e desacoplado: Domínio → Use Cases → Context API e Sessão Segura → Componentes/Telas com Fakes, tudo testado com TDD antes que qualquer dado toque em um banco de dados permanente (SQLite ou Supabase).

1. Camada de Domínio Puro (domain/)
O domínio contém as regras de negócio centrais e é 100% puro, sem qualquer importação ou dependência do React, Expo ou bibliotecas de UI.

Value Objects (Objetos de Valor): Tipos imutáveis, sem identidade própria e validados na criação:
Criterio: Armazena nome e nota (0-10) e calcula a faixa (MB, B, R, F).
Coordenada: Armazena latitude, longitude e marca temporal (timestamp).
Assinatura: Representa a assinatura digital (base64 + timestamp).
CargaHoraria: Valida horas totais, mínimas e do período.
StatusSincronizacao: Enum (pending | synced | error).
StatusPeriodo: Enum do ciclo de vida de negócio do relatório.
Entidades e Agregados (Entities & Aggregate Roots):
PeriodoAvaliacao (Aggregate Root): Agrupa e gerencia o ciclo de vida das AtividadesDesenvolvidas, AvaliacaoSupervisor, AutoAvaliacao e assinaturas. Protege invariantes de negócio (ex.: bloqueia o registro de uma 2ª avaliação se o período já estiver como Aprovado e valida se podeGerarPdf() apenas com todas as assinaturas sincronizadas).
Estagio e TokenSupervisor: Entidades com raízes e ciclos de vida próprios (o supervisor acessa via token com expiração e revogação sem ter conta de autenticação padrão).
Serviços de Domínio (Domain Services): Regras cruzadas como RegraGeracaoPdfService, RegraDevolucaoService e SincronizacaoService.
Contratos e Interfaces: Definição puramente declarativa das interfaces de repositórios (PeriodoAvaliacaoRepository) e gateways (CameraGateway, LocationGateway, AuthGateway).
2. Camada de Aplicação (application/use-cases/)
Contém a lógica de orquestração do sistema. Os casos de uso chamam as entidades do domínio e se comunicam através das interfaces dos repositórios e gateways, sem conter regras de negócio puras ou código de interface.

Casos de Uso Implementados:
RegistrarAtividadesUseCase
AvaliarDesempenhoUseCase e RealizarAutoAvaliacaoUseCase
AssinarRelatorioUseCase, AprovarRelatorioUseCase e DevolverRelatorioUseCase
GerarPdfUseCase e SincronizarFilaUseCase
AutenticarUsuarioUseCase e AcessarViaTokenUseCase
Testes com Fakes In-Memory: Testados via TDD com implementações fake em memória (ex.: PeriodoAvaliacaoRepositoryFake que utiliza um Map para simular o banco), cobrindo o caminho feliz, tratamento de erros e falta de permissões sem dependência externa.
3. Camada de Adaptadores, Estado Global e Context API (adapters/)
Nesta camada residem a Context API, o armazenamento de sessão local e a integração entre o ciclo de vida do React Native e os Casos de Uso.

Context API (adapters/context/AuthContext.tsx):
Localização Arquitetural: Fica na camada de Adapters/UI. O domínio e a camada de aplicação nunca importam a Context API.
Responsabilidade: Elimina o Prop Drilling do usuário autenticado (Aluno, Orientador ou Coordenação). O componente <AuthProvider> envolve a raiz do aplicativo e disponibiliza o estado da sessão globalmente, permitindo que qualquer tela leia o usuário logado com useContext.
Gerenciamento de Sessão Segura (adapters/auth/SessionStorageSecureStore.ts):
Implementa a interface SessionStorage atuando como um wrapper sobre a biblioteca expo-secure-store.
Criptografa o token de sessão diretamente no dispositivo (Keychain no iOS / Keystore no Android), evitando o uso de armazenamento não seguro.
Custom Hooks de Ponte (adapters/hooks/):
Hooks como useAuth e useAtividades atuam como a fronteira entre as telas e os Use Cases. Eles adaptam os Casos de Uso ao ciclo de vida do componente React (gerenciando estados como idle, salvando, salvo) sem acoplar as telas diretamente aos Use Cases.
Gateways de Hardware (Adapters):
CameraGatewayExpo: Embrulha a biblioteca nativa expo-camera atrás da interface declarada no domínio, mantendo a câmera desacoplada para facilitar os testes.
4. Camada de Interface do Usuário e Rotas (app/ e adapters/screens/)
Navegação e Rotas (Expo Router - app/):
A estrutura de arquivos em app/ (ex.: app/login.tsx, app/(aluno)/atividades.tsx) funciona como a fronteira de entrada visual (Boundary), onde as interações de toque do usuário entram no aplicativo.
Layouts e Componentes Visuais:
Construídos com componentes nativos <View> e <Text> e estilizados via StyleSheet e Flexbox (com eixos configurados em flexDirection: column por padrão).
Telas Principais:
AssinaturaScreen, AtividadesFormScreen e HistoricoRelatoriosScreen.
5. O que FICA EM MOCK / FAKE nesta fase (Sem Banco ou Hardware Real)
Para garantir a isolamento total e testes ultrarrápidos, os seguintes componentes permanecem mockados ou em memória:

Sem Armazenamento Permanente Real: Nenhuma conexão ativa com banco SQLite local (expo-sqlite) ou banco relacional em nuvem (@supabase/supabase-js).
Sem Acesso Nativo a Sensores: As chamadas para APIs de Câmera (expo-camera) e Localização (expo-location) usam Gateways Fakes/Mocks em ambiente de teste.
Fakes de Repositorio & Session Stubs: Uso de estruturas Map em memória para repositórios e stubs de autenticação devolvendo sessões válidas para montagem das telas.
6. Estratégia de Testes e Cobertura (Meta 80%+)
A suíte de testes é organizada de acordo com a pirâmide de testes do projeto:

Testes de Domínio (Maior Volume): Testes unitários puros de Entidades e Value Objects, rodando 100% em memória e sem necessidade de mocks.
Testes de Use Cases (Volume Alto): Validação das regras de orquestração e fluxos alternativos injetando repositórios e gateways fakes em memória via TDD.
Testes do Context API & Hooks (Volume Médio): Validação do AuthProvider e do hook useAuth, garantindo o carregamento da sessão salva e a integração com os Use Cases de login.
Testes de Telas e Componentes (RNTL + jest-expo): Testes com @testing-library/react-native que usam render(), fireEvent.press e fireEvent.changeText para simular as ações do usuário nas telas envolvidas pelo <AuthProvider> e injetadas com Use Cases Fakes.
Testes E2E (Pouquíssimos): Reservados para fluxos críticos completos.
7. Checklist Sequencial de Construção
A ordem exata de implementação sugerida para a equipe de desenvolvimento é:

Value Objects: Criterio, Coordenada, Assinatura, CargaHoraria (testes puros).
Entities & Aggregates: PeriodoAvaliacao, Estagio, TokenSupervisor (invariantes testadas).
Domain Services: RegraGeracaoPdfService, RegraDevolucaoService, SincronizacaoService.
Interfaces de Repository / Gateway: Contratos definidos no domínio.
Use Cases: Orquestração com fakes in-memory (ciclo Red-Green-Refactor).
Context API + Custom Hooks: AuthContext, useAuth e useAtividades conectando Use Cases ao ciclo de vida.
Telas com RNTL: AssinaturaScreen, AtividadesFormScreen com Use Cases Fakes injetados.
Sessão Segura: Adaptador SessionStorageSecureStore encapsulando expo-secure-store (mockado nos testes).