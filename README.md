# 🐾 Enlace — Rede de Adoção de Animais

> Aplicativo mobile offline-first para divulgação e descoberta de animais disponíveis para adoção, aproximando interessados de protetores independentes, ONGs, abrigos e tutores responsáveis.

---

## 🎯 Visão Geral

O **Enlace** é uma plataforma mobile (desenvolvida com React Native e Expo Router) concebida para simplificar a descoberta e a adoção responsável de animais de estimação.

- **Sem matching automático**: A descoberta ocorre de forma transparente por meio de pesquisas textuais, filtros avançados (espécie, porte, idade, sexo), visualização em lista e mapa interativo.
- **Offline-First**: Funciona de forma resiliente em locais de conectividade limitada. Permite consultar animais armazenados localmente, favoritar, criar e editar anúncios sem internet. Operações pendentes são registradas em uma fila local persistente (`sync_queue`) e sincronizadas automaticamente quando a rede é restabelecida.
- **Privacidade & Segurança**: A localização exata do anunciante nunca é exposta (somente bairro, cidade e coordenadas aproximadas). Políticas de autorização garantem que apenas o proprietário do anúncio possa editá-lo ou marcá-lo como adotado.

### Três Pilares Técnicos

| Pilar | Tecnologia | Função |
|---|---|---|
| **Resiliência Offline** | SQLite Local + Sync Queue | Garante cadastro e edição de anúncios sem internet, com sincronização idempotente posterior |
| **Arquitetura Desacoplada** | Clean Architecture + Ports & Adapters | Domínio e Regras de Negócio 100% puros, sem acoplamento a React, Expo, SQLite ou Supabase |
| **Privacidade por Design** | Geolocalização Aproximada | Arredondamento de coordenadas e exibição exclusiva de bairros/regiões |

### Fluxo Principal

```text
Consulta / Busca → Aplicar Filtros → Visualizar Detalhes → Favoritar / Demonstrar Interesse → Contato com Responsável → Marcar como Adotado
```
*(Fluxo Offline: Cadastro/Edição local → Registro na SyncQueue → Conexão Restabelecida → Processamento e Reconciliação Remota)*

---

## 🧱 Stack Técnica

### Mobile Client
- **Framework**: React Native ~0.76.6 + Expo ~52.0.0 + TypeScript ^5.3.3
- **Navegação & Rotas**: Expo Router ~4.0.0 (File-based routing na pasta `app/`)
- **UI Components**: React Native Native (`<View>`, `<Text>`, `<TextInput>`, `<TouchableOpacity>`, `<FlatList>`, `StyleSheet` com Flexbox `column`)
- **Estado Global & Sessão**: Context API (`AuthProvider` / `AuthContext`) + Custom Hooks (`useAuth`, `useAnimals`, `useSync`, `useAtividades`)

### Persistência & Sessão Segura
- **Banco Operacional Local**: SQLite (`expo-sqlite`) para armazenamento de cache de anúncios e fila de sincronização
- **Armazenamento Seguro**: `SessionStorageSecureStore` (`expo-secure-store`) para criptografia de sessão diretamente no dispositivo (Keychain no iOS / Keystore no Android)

### Backend Remote Target (Sincronização Remota)
- **Banco Remoto**: Supabase PostgreSQL (Tabelas `animals`, `profiles`, `favorites`, `adoption_interests`, `animal_photos`)
- **Autenticação**: Supabase Auth (E-mail/Senha e Acesso via Token)
- **Storage de Mídia**: Supabase Storage para upload de imagens de anúncios
- **Segurança**: Políticas de Row Level Security (RLS)

### Testes & Qualidade
- **Runner**: Jest ^29.7.0 + `jest-expo` ~52.0.0
- **Testing Library**: `@testing-library/react-native` (RNTL)
- **Metodologia**: Test-Driven Development (TDD) com implementações Fake em memória (`AnimalRepositoryFake`, `SyncQueueRepositoryFake`, `AuthGatewayFake`, `SessionStorageFake`, etc.)
- **Meta de Cobertura**: 80%+ (Alcançado **89.06% em Linhas** e **80.62% em Branches**)

---

## 📁 Estrutura do Projeto (Clean Architecture)

```text
Projeto_DevMobile/
├── app/                                  # Camada 4: Roteamento Expo Router (Boundary Visual)
│   ├── _layout.tsx                       # Layout Raiz e Provedor de Sessão (<AuthProvider>)
│   └── index.tsx                         # Tela Inicial de Pesquisa e Listagem
├── src/                                  # Código-fonte da aplicação
│   ├── domain/                           # Camada 1: Domínio Puro (100% TypeScript Isento de Frameworks)
│   │   ├── entities/                     # Entidades & Agregados (Animal, SyncAction, User, Favorite, PeriodoAvaliacao, etc.)
│   │   ├── value-objects/                # Objetos de Valor (ApproximateLocation, AdoptionStatus, SyncState, AnimalCharacteristics, etc.)
│   │   ├── services/                     # Serviços de Domínio (ConflictResolutionService, SincronizacaoService, RegraGeracaoPdfService, etc.)
│   │   └── ports/                        # Interfaces Declarativas (AnimalRepository, SyncQueueRepository, AuthGateway, etc.)
│   ├── application/                      # Camada 2: Casos de Uso e Orquestração
│   │   ├── use-cases/                    # Casos de Uso (SearchAnimals, CreateAnimal, MarkAnimalAdopted, ProcessSyncQueue, etc.)
│   │   └── fakes/                        # Reposositórios e Gateways Fakes In-Memory para TDD
│   └── adapters/                         # Camada 3: Adaptadores, Estado Global e Interfaces React Native
│       ├── context/                      # AuthContext.tsx (<AuthProvider> eliminando Prop Drilling)
│       ├── auth/                         # SessionStorageSecureStore.ts (Wrapper sobre expo-secure-store)
│       ├── hooks/                        # Custom Hooks de Ponte (useAuth, useAnimals, useSync, useAtividades)
│       ├── gateways/                     # Gateways de Hardware (CameraGatewayExpo)
│       └── screens/                      # Telas Nativas (SearchScreen, AnimalDetailsScreen, AnimalFormScreen, AssinaturaScreen, etc.)
├── __tests__/                            # Suíte de Testes Automatizados TDD
│   ├── domain/                           # Testes Unitários Puros de VOs, Entidades e Serviços (100% Memória)
│   ├── application/                      # Testes dos Casos de Uso com Fakes In-Memory
│   ├── adapters/                         # Testes do AuthContext, Session Storage e Hooks de Ponte
│   └── screens/                          # Testes de Componentes e Telas com React Native Testing Library (RNTL)
├── documentacao-software-rede-adocao-animais.md  # Especificação técnica e documento de arquitetura
├── criteriosapresentacao1.md             # Rubrica da Fase "Domínio e Interface Primeiro"
├── jest.config.js                        # Configuração do Jest com limite de cobertura (80%+)
├── tsconfig.json                         # Configuração de Paths do TypeScript (@/*)
└── package.json                          # Scripts e dependências do projeto
```

---

## 📋 Módulos de Implementação

| # | Módulo / Fase | Descrição | Status |
|---|---|---|:---:|
| 1 | **Domínio e Interface Primeiro** | Modelo de domínio puro, Objetos de Valor, Entidades, Use Cases, Context API, Hooks e Telas com 100% Fakes em memória e >80% de cobertura. | 🟢 **Concluído** |
| 2 | **Persistência Operacional SQLite** | Migrations e repositórios locais em SQLite para cache de anúncios e persistência da fila offline (`sync_queue`). | ⏳ Em breve |
| 3 | **Integração Remota Supabase** | Implementação de clientes remotos Supabase, autenticação JWT/OAuth, RLS e upload de fotos no Storage. | ⏳ Em breve |
| 4 | **Motor de Sincronização & Reconciliação** | Sincronização em segundo plano disparada por alteração de rede (NetInfo), controle de versão e resolução de conflitos. | ⏳ Em breve |
| 5 | **Integração Nativa com Sensores** | Suporte às APIs nativas do dispositivo para Câmera (`expo-camera`), Galeria e Geolocalização (`expo-location`). | ⏳ Em breve |

---

## 🧪 Estratégia de Testes & Cobertura

A aplicação foi desenvolvida seguindo o ciclo **TDD (Red-Green-Refactor)** e organizada conforme a pirâmide de testes do projeto:

| Tipo de Teste | Escopo | Tecnologias | Cobertura Obtida |
|---|---|---|:---:|
| **Testes de Domínio** | Value Objects, Entidades, Agregados, Invariantes e Serviços de Domínio | Jest (100% em memória) | **100% VOs / 90.79% Entidades** |
| **Testes de Use Cases** | Orquestração, caminhos felizes e fluxos alternativos com Fakes In-Memory | Jest + In-Memory Fakes | **83.45% Use Cases** |
| **Testes de Context & Hooks** | `AuthProvider`, manutenção de sessão e hooks de integração com a UI | Jest + `@testing-library/react-native` | **95.12% Context / 98.78% Hooks** |
| **Testes de Telas (UI)** | Renderização, interações de toque (`fireEvent.press`) e formulários | React Native Testing Library (RNTL) | **93.54% Telas** |

### Resultado Final da Cobertura (`npm test -- --coverage`)

```text
-------------------|---------|----------|---------|---------|
File               | % Stmts | % Branch | % Funcs | % Lines |
-------------------|---------|----------|---------|---------|
All files          |   87.66 |    80.62 |   85.54 |   89.06 |
-------------------|---------|----------|---------|---------|
```

---

## 🚀 Quick Start

### Pré-requisitos
- Node.js (v20.x ou v22.x instalado)
- npm (v10.x+)
- Expo Go instalado no smartphone ou emulador Android/iOS (opcional para execução visual)

### Passo a Passo

```bash
# 1. Clonar o repositório
git clone <repo-url>
cd Projeto_DevMobile

# 2. Instalar as dependências do projeto
npm install

# 3. Executar os testes automatizados com relatório de cobertura (80%+)
npm test -- --coverage

# 4. Validar a checagem de tipos estáticos do TypeScript (0 erros)
npm run typecheck

# 5. Iniciar o servidor de desenvolvimento do Expo
npm start
```

---

## 📐 Convenções do Projeto

- **Arquitetura Limpa**: A camada de Domínio nunca importa bibliotecas do React, Expo, SQLite ou Supabase.
- **TDD (Test-Driven Development)**: Novas funcionalidades devem possuir testes escritos e falhando antes da implementação do código.
- **Componentes Visuais**: Estilização via `StyleSheet` nativo utilizando Flexbox com alinhamento vertical padrão (`flexDirection: 'column'`).
- **Commits**: Seguir a especificação Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- **Idioma**: Português (PT-BR) para documentação, nomes de tela e mensagens de erro exibidas ao usuário final.

---

## 📄 Documentação Detalhada

| Documento | Descrição |
|---|---|
| [documentacao-software-rede-adocao-animais.md](file:///home/alunos/Downloads/Projeto_DevMobile/documentacao-software-rede-adocao-animais.md) | Especificação completa de requisitos (RF/RNF), diagrama de casos de uso, DER, diagramas de sequência, atividades, componentes e decisões de arquitetura do app **Enlace**. |

---

## 📝 Licença

Este projeto é desenvolvido para fins acadêmicos e educacionais. Todos os direitos reservados.
