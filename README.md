# 🐾 Enlace — Rede de Adoção de Animais

> Aplicativo mobile offline-first para divulgação e descoberta de animais disponíveis para adoção, aproximando interessados de protetores independentes, ONGs, abrigos e tutores responsáveis.

---

## 📱 Sobre o App

O **Enlace** é um aplicativo mobile (React Native + Expo Router) que conecta quem quer adotar a quem precisa encontrar um lar para um animal.

### O que o usuário pode fazer

| Perfil | Funcionalidades |
|---|---|
| **Visitante** | Pesquisar animais por texto, filtrar por espécie, porte, sexo e idade, ver lista e detalhes de cada anúncio |
| **Usuário autenticado** | Favoritar animais, ver sua lista de favoritos e demonstrar interesse em adotar |
| **Responsável (anunciante)** | Criar, editar e excluir anúncios, marcar um animal como **adotado** e gerenciar "Meus anúncios" |
| **Todos** | Usar o app **sem internet**: ações ficam numa fila local e são sincronizadas quando a conexão volta |

### Telas principais

- **Início**: busca textual e filtros
- **Detalhes do animal** (`/animal/[id]`): fotos, características, localização aproximada e contato
- **Favoritos**: animais salvos pelo usuário
- **Meus anúncios**: editar, excluir e marcar como adotado
- **Novo anúncio / Editar anúncio**: formulário de cadastro
- **Sync**: estado da fila de sincronização offline
- **Login / Cadastro**: autenticação (stub nesta fase)

### Princípios

- **Sem matching automático**: a descoberta é transparente, feita por busca, filtros, lista e mapa.
- **Offline-first**: cadastro e edição funcionam sem rede. Pendências vão para a fila `sync_queue` e são reenviadas depois, sem perda silenciosa.
- **Privacidade por design**: o endereço exato nunca é exposto. O app mostra só bairro, cidade e coordenadas aproximadas.
- **Segurança**: apenas o dono do anúncio pode editá-lo ou marcá-lo como adotado.

### Fluxo principal

```text
Busca → Filtros → Detalhes → Favoritar / Demonstrar interesse → Contato com responsável → Marcar como adotado
```
*(Offline: cadastro/edição local → SyncQueue → conexão restabelecida → sincronização e reconciliação)*

---

## 🧱 Stack Técnica

| Camada | Tecnologia |
|---|---|
| Framework | Expo SDK **~57** + React Native **0.86** + React **19.2** |
| Linguagem | TypeScript ~6.0 |
| Navegação | Expo Router ~57 (rotas por arquivo na pasta `app/`) |
| Estado | Context API (`AuthProvider`) + hooks (`useAuth`, `useAnimals`, `useSync`) |
| Persistência local | SQLite (`expo-sqlite`), prevista para a Fase 2 |
| Sessão segura | `SessionStorageSecureStore` (mockado; `expo-secure-store` real na Fase 4) |
| Backend (futuro) | Supabase: Auth, PostgreSQL, Storage e RLS (Fase 3) |
| Testes | Jest 29 + `jest-expo` + React Native Testing Library |

---

## 🚀 Como Rodar

### Pré-requisitos

- **Node.js** 20.x ou 22.x
- **npm** 10.x ou superior
- App **Expo Go** no celular ([Android](https://play.google.com/store/apps/details?id=host.exp.exponent) / [iOS](https://apps.apple.com/app/expo-go/id982107779)), compatível com o **SDK 57**
- *(Opcional)* emulador Android (Android Studio) ou simulador iOS (Xcode, só no macOS)

### 1. Instalação

```bash
git clone <repo-url>
cd Projeto_DevMobile
npm install
```

### 2. Rodar no celular com Expo Go

```bash
npx expo start          # ou: npm start
```

1. Conecte o celular **na mesma rede Wi‑Fi** do computador.
2. **Android**: abra o Expo Go e escaneie o QR code do terminal.
3. **iOS**: escaneie o QR code com a câmera do iPhone.

**Rede bloqueada** (faculdade, empresa, rede isolada)? Use o modo túnel:

```bash
npx expo start --tunnel
```

> Na primeira vez ele pode pedir para instalar o `@expo/ngrok`. Responda `y`.

### 3. Outras formas de rodar

```bash
npm run android         # abre direto no emulador/dispositivo Android
npm run ios             # abre no simulador iOS (somente macOS)
```

### Atalhos no terminal do Expo (com o servidor rodando)

| Tecla | Ação |
|:---:|---|
| `a` | Abrir no Android |
| `i` | Abrir no iOS |
| `r` | Recarregar o app |
| `m` | Abrir o menu de desenvolvedor |
| `j` | Abrir o debugger |
| `Ctrl+C` | Encerrar o servidor |

---

## 🧪 Testes e Qualidade

```bash
npm test                    # roda todos os testes (jest --runInBand)
npm run test:coverage       # testes + relatório de cobertura
npx jest caminho/do/arquivo.test.ts   # roda um teste específico
npx jest --watch            # modo observação (TDD)
npm run typecheck           # checagem de tipos (tsc --noEmit)
npx expo-doctor             # valida a configuração do projeto Expo
```

O relatório de cobertura em HTML fica em `coverage/lcov-report/index.html`.

**Meta de cobertura: ≥ 80%** em branches, functions, lines e statements, exigida em `jest.config.js`.

| Tipo de teste | Escopo | Ferramentas |
|---|---|---|
| Domínio | Value Objects, entidades, invariantes e serviços | Jest (100% em memória) |
| Casos de uso | Orquestração e fluxos alternativos | Jest + fakes in-memory |
| Context e hooks | `AuthProvider`, sessão e hooks | Jest + RNTL |
| Telas | Renderização, toques e formulários | RNTL |
| E2E (mock) | Fluxos críticos: busca → detalhes, favoritar, criar, marcar adotado | Jest + `expo-router` mockado |

---

## 🛠️ Solução de Problemas

| Problema | Solução |
|---|---|
| QR code não conecta | Use `npx expo start --tunnel` ou confira se o PC e o celular estão na mesma rede |
| "Project is incompatible with this version of Expo Go" | Atualize o Expo Go na loja (o projeto usa o SDK 57) |
| Cache estranho ou bundle desatualizado | `npx expo start -c` (limpa o cache do Metro) |
| Dependências quebradas | `rm -rf node_modules package-lock.json && npm install` |
| Versões incompatíveis de pacotes Expo | `npx expo install --fix` |

---

## 📁 Estrutura do Projeto (Clean Architecture)

```text
Projeto_DevMobile/
├── app/                      # Rotas Expo Router: (tabs), animal/[id], (protected), login, cadastro
├── src/
│   ├── domain/               # Domínio puro (sem React, Expo, SQLite ou Supabase)
│   │   ├── entities/         # Animal, AnimalPhoto, Favorite, AdoptionInterest, SyncAction, User...
│   │   ├── value-objects/    # ApproximateLocation, AdoptionStatus, SyncState, AnimalCharacteristics...
│   │   ├── services/         # ConflictResolutionService, SincronizacaoService...
│   │   └── ports/            # Interfaces: AnimalRepository, SyncQueueRepository, AuthGateway, PhotoStorage...
│   ├── application/
│   │   ├── use-cases/        # SearchAnimals, CreateAnimal, UpdateAnimal, MarkAnimalAdopted, ProcessSyncQueue...
│   │   └── fakes/            # Repositórios e gateways in-memory para TDD
│   └── adapters/
│       ├── context/          # AuthContext (AuthProvider)
│       ├── auth/             # SessionStorageSecureStore
│       ├── hooks/            # useAuth, useAnimals, useSync
│       ├── gateways/         # Gateways de hardware (câmera)
│       ├── demo/             # Fakes compartilhados para rodar o app em modo demo
│       └── screens/          # Telas React Native
├── __tests__/                # domain/, application/, adapters/, screens/, e2e/
├── docs/                     # Especificação, critérios e próximos passos
├── app.json                  # Configuração Expo (scheme: "enlace")
├── jest.config.js            # Jest + limite de cobertura (80%)
└── package.json
```

---

## 📋 Roadmap

| # | Fase | Status |
|---|---|:---:|
| 1 | Domínio e interface primeiro (100% fakes, cobertura ≥ 80%) | 🟢 Concluído |
| 2 | Persistência local real (SQLite) | ⏳ Pendente |
| 3 | Backend Supabase (Auth, PostgreSQL, Storage, RLS) | ⏳ Pendente |
| 4 | Dispositivo real (câmera, localização, conectividade, secure store) | ⏳ Pendente |
| 5 | Rotas Expo Router completas | 🟡 Parcial |
| 6 | Sincronização fim a fim, conflitos e moderação | ⏳ Pendente |
| 7 | Requisitos de desempenho e escalabilidade | ⏳ Pendente |
| 8 | Testes E2E finais e apresentação | 🟡 5/8 fluxos em mock |

Detalhes e bloqueadores de produto estão em [docs/nextsteps.md](docs/nextsteps.md).

---

## 📐 Convenções

- **Clean Architecture**: o domínio nunca importa React, Expo, SQLite ou Supabase.
- **TDD**: escreva o teste falhando antes da implementação.
- **Estilo**: `StyleSheet` nativo com Flexbox (`flexDirection: 'column'`).
- **Commits**: Conventional Commits (`feat:`, `fix:`, `test:`, `docs:`, `chore:`).
- **Idioma**: PT-BR na documentação e nas mensagens ao usuário.

---

## 📄 Documentação

| Documento | Descrição |
|---|---|
| [docs/documentacao-software-rede-adocao-animais.md](docs/documentacao-software-rede-adocao-animais.md) | Requisitos (RF/RNF), casos de uso, DER, diagramas e decisões de arquitetura |
| [docs/criteriosapresentacao1.md](docs/criteriosapresentacao1.md) | Rubrica da fase "Domínio e Interface Primeiro" |
| [docs/nextsteps.md](docs/nextsteps.md) | Próximos passos por fase e bloqueadores |

---

## 📝 Licença

Projeto desenvolvido para fins acadêmicos e educacionais. Todos os direitos reservados.
