# Grafo de Arquitetura, Navegação e Fluxos — Enlace

Este documento serve como mapa visual e técnico do aplicativo **Enlace — Rede Comunitária de Adoção de Animais**, detalhando a navegação entre telas, a ação de cada botão da interface, o grafo de dependências da Clean Architecture e o ciclo de sincronização offline-first.

---

## 1. Grafo de Navegação e Ações de Botões (`app/`)

```mermaid
flowchart TD
    Root["app/index.tsx"] -->|"Redireciona"| Tabs["app/(tabs)/_layout.tsx"]

    subgraph Public["Rotas Públicas — app/(public)"]
        V01["V01 • login.tsx"]
        V02["V02 • cadastro.tsx"]
        V01 -->|"Botão: Criar conta"| V02
        V02 -->|"Link: Já tem conta? Entrar"| V01
        V01 -->|"Botão: Entrar / Continuar como visitante"| Tabs
        V02 -->|"Botão: Criar conta"| Tabs
    end

    subgraph MainTabs["Abas Principais — app/(tabs)"]
        V03["V03/V04/V05 • index.tsx (Explorar: Lista / Mapa / Filtros)"]
        V07["V07 • favoritos.tsx (Favoritos)"]
        V09["V09 • meus-anuncios.tsx (Meus Anúncios)"]
        V13["V13 • sync.tsx (Sincronização)"]
        V08_12["V08/V12 • conta.tsx (Visitante / Meu Perfil)"]
        Notif["Decisão 20 • notificacoes.tsx (Central de Notificações)"]
    end

    subgraph Details["Detalhes do Animal — app/animal/[id].tsx"]
        V06["V06 • Visão Visitante / Adotante"]
        V16["V16 • Visão Responsável (Dono)"]
    end

    subgraph Protected["Rotas Protegidas — app/(protected)"]
        V10["V10 • novo-anuncio.tsx"]
        V11["V11 • editar-anuncio/[id].tsx"]
        V14["V14 • conflito/[id].tsx"]
        V15["V15 • moderacao.tsx (Admin)"]
    end

    V03 -->|"Toque no Card / Ver anúncio no Mapa"| Details
    V07 -->|"Toque no Card"| Details
    V09 -->|"Toque no Card"| Details
    V09 -->|"Botão: + Novo anúncio"| V10
    V09 -->|"Botão: Editar"| V11
    V16 -->|"Botão: Editar"| V11
    V13 -->|"Toque em item com [CONFLITO] / Revisar"| V14
    V13 -->|"Toque em item pendente (animal/favorito/interesse)"| Details
    Notif -->|"Toque na notificação de interesse"| Details
    Notif -->|"Toque em falha de sync"| V13
    V08_12 -->|"Botão: Painel de Moderação (role=ADMIN)"| V15
    V08_12 -->|"Visitante: Entrar / Criar conta"| V01
```

---

## 2. Grafo de Dependências em Clean Architecture (`app` → `adapters` → `application` → `domain` ← `infrastructure`)

```mermaid
flowchart LR
    subgraph UI["1. UI / Rotas (app/)"]
        Screens["17 Telas Expo Router"]
    end

    subgraph Adapters["2. Adapters (src/adapters/)"]
        Contexts["AuthContext / RepositoriesContext"]
        Hooks["useAutoSync / useFullSync / useConnectivity / useUseCases"]
        Components["EnlaceHeader / PhotoCarouselViewer / OwnerInterestsCard / AdoptionInterestModal / exportAnimalPdf"]
        SecureStore["SessionStorageSecureStore"]
    end

    subgraph Application["3. Application (src/application/)"]
        AnimalUCs["Search / GetDetails / Create / Update / Delete / MarkAdopted / Moderate"]
        SocialUCs["ToggleFavorite / RegisterInterest / UpdateInterestStatus"]
        SyncUCs["RunFullSync / ProcessSyncQueue / PullRemoteAnimals / PullRemoteInterests / ResolveConflict"]
        PhotoDec["WebpPhotoStorage (Decorator)"]
    end

    subgraph Domain["4. Domain Puro (src/domain/)"]
        Entities["Animal / AnimalPhoto / User / Favorite / AdoptionInterest / SyncAction / SyncMetadata / SearchPreferences"]
        VOs["ApproximateLocation / AnimalCharacteristics / SearchRadius / AdoptionStatus / SyncState"]
        Services["ConflictResolutionService / AccessPolicy / IdGenerator"]
        Ports[["18 Interfaces em domain/ports/"]]
    end

    subgraph Infra["5. Infrastructure (src/infrastructure/)"]
        SQLite["SQLite (DatabaseDriver + migrations v1..v3 + 9 Repositories + SqliteUnitOfWork)"]
        Supabase["Supabase (AuthGateway + AnimalRepo + UserDataGateways + ModerationRepo + PhotoStorage)"]
        Device["Device (ImagePickerCamera + ExpoImageManipulator + ExpoLocation + NetInfo)"]
    end

    Screens --> Contexts
    Screens --> Hooks
    Screens --> Components
    Hooks --> AnimalUCs
    Hooks --> SocialUCs
    Hooks --> SyncUCs
    AnimalUCs --> Entities
    SocialUCs --> Entities
    SyncUCs --> Services
    AnimalUCs --> Ports
    SocialUCs --> Ports
    SyncUCs --> Ports
    PhotoDec --> Ports
    SQLite -.->|"implementa"| Ports
    Supabase -.->|"implementa"| Ports
    Device -.->|"implementa"| Ports
    SecureStore -.->|"implementa"| Ports
```

---

## 3. Grafo do Ciclo de Sincronização Offline-First e Trilha de Adoção

```mermaid
sequenceDiagram
    participant U as Usuário (UI)
    participant UC as UseCase (Create / Update / Interest)
    participant UoW as SqliteUnitOfWork (SQLite)
    participant Sync as RunFullSyncUseCase
    participant SB as Supabase (Storage + Postgres RLS)

    U->>UC: Ação (Criar Pet / Favoritar / Concluir Interesse)
    UC->>UoW: Grava entidade local + Enfileira SyncAction (Transação Atômica)
    alt Dispositivo Online
        UC->>SB: Envia Foto WebP + Upsert/Insert Remoto imediato
        SB-->>UC: 200 OK
        UC->>UoW: Remove SyncAction da sync_queue
    else Dispositivo Offline ou Falha de Rede
        UC->>UoW: Mantém SyncAction (PENDING / FAILED) na sync_queue
    end
    U->>Sync: Reconexão / Pull-to-Refresh / Botão "Sincronizar agora"
    Sync->>SB: 1. Push (ProcessSyncQueueUseCase — isolado por ownerId DAT-10)
    Sync->>SB: 2. Pull Animais + Tombstones (PullRemoteAnimalsUseCase — cursor 60s overlap)
    Sync->>SB: 3. Pull Interesses + Retiradas (PullRemoteInterestsUseCase)
    Sync-->>U: notifyPullCompleted() + notifyNotificationsChanged()
```

---

## 4. Mapa Completo: Tela → Botões → Casos de Uso → Persistência

| Tela (`app/`) | Botões / Interações | Caso de Uso / Serviço Acionado | Tabelas SQLite / Supabase Afetadas |
|---|---|---|---|
| **V01 • `login.tsx`** | `Entrar`, `Criar conta`, `Continuar como visitante`, `Mostrar/ocultar senha` | `AuthContext.login` → `SupabaseAuthGateway.login` | `users` (SQLite), `auth.users` / `public.users` (Supabase), `SecureStore` |
| **V02 • `cadastro.tsx`** | `Criar conta`, `Já tem conta? Entrar`, `Voltar` | `AuthContext.register` → `SupabaseAuthGateway.register` | `users` (SQLite), `auth.users` / `public.users` (Supabase), `SecureStore` |
| **V03/V04/V05 • `index.tsx`** | `Busca textual`, `Pílula de cidade`, `Botão de filtros`, `Chips Todos/Cães/Gatos`, `Toggle Lista/Mapa`, `Favoritar (♥)`, `Pull-to-Refresh`, `Ver anúncio (Mapa)` | `SearchAnimalsUseCase`, `ToggleFavoriteUseCase`, `SearchPreferencesRepository`, `LocationGateway`, `RunFullSyncUseCase` | `animals`, `animal_photos`, `favorites`, `search_preferences`, `sync_queue` |
| **V06 • `animal/[id].tsx` (Adotante)** | `Voltar`, `Favoritar (♥)`, `Carrossel + Zoom 1x–4x`, `Demonstrar interesse`, `Cancelar meu interesse`, `Gerar PDF do anúncio` | `GetAnimalDetailsUseCase`, `ToggleFavoriteUseCase`, `RegisterAdoptionInterestUseCase.execute / .cancel`, `exportAnimalPdf` | `animals`, `favorites`, `adoption_interests`, `sync_queue` |
| **V16 • `animal/[id].tsx` (Responsável)** | `Editar`, `Marcar como adotado`, `Reabrir para adoção`, `Remover (lixeira)`, `Botões da trilha (Enviada / Em análise / Visita combinada / Concluída / Recusada)`, `Gerar PDF do anúncio` | `MarkAnimalAdoptedUseCase.execute / .reopen`, `DeleteAnimalUseCase`, `UpdateInterestStatusUseCase` (com auto-adoção em `CONCLUIDA`), `exportAnimalPdf` | `animals`, `adoption_interests`, `animal_tombstones`, `sync_queue` |
| **V07 • `favoritos.tsx`** | `Toque no card`, `Remover favorito (♥)`, `Pull-to-Refresh`, `Entrar na minha conta (visitante)` | `ToggleFavoriteUseCase`, `RunFullSyncUseCase` | `favorites`, `animals`, `sync_queue` |
| **V08/V12 • `conta.tsx`** | `Tirar foto`, `Galeria`, `Chips de interesses`, `Salvar alterações`, `Painel de Moderação (Admin)`, `Sair` | `CameraGateway`, `WebpPhotoStorage`, `SupabasePhotoStorage`, `AuthContext.updateProfile / .logout` | `users`, `local_images`, bucket `animal-photos` |
| **V09 • `meus-anuncios.tsx`** | `+ Novo anúncio`, `Toque no card`, `Editar`, `Adotado`, `Reabrir`, `Excluir`, `Pull-to-Refresh` | `MarkAnimalAdoptedUseCase.execute / .reopen`, `DeleteAnimalUseCase`, `RunFullSyncUseCase` | `animals`, `animal_tombstones`, `sync_queue` |
| **V10 • `novo-anuncio.tsx`** | `Câmera`, `Galeria`, `Remover miniatura (x)`, `Chips Espécie/Sexo/Porte`, `Usar minha localização (GPS)`, `Salvar anúncio` | `CameraGateway`, `LocationGateway`, `CreateAnimalUseCase`, `WebpPhotoStorage`, `SqliteUnitOfWork` | `animals`, `animal_photos`, `local_images`, `sync_queue`, bucket `animal-photos` |
| **V11 • `editar-anuncio/[id].tsx`** | `Câmera`, `Galeria`, `Remover miniatura (x)`, `Chips Espécie/Sexo/Porte`, `Usar minha localização (GPS)`, `Salvar alterações` | `CameraGateway`, `LocationGateway`, `UpdateAnimalUseCase`, `WebpPhotoStorage`, `SqliteUnitOfWork` | `animals`, `animal_photos`, `local_images`, `sync_queue`, bucket `animal-photos` |
| **V13 • `sync.tsx`** | `Sincronizar agora`, `Pull-to-Refresh`, `Toque no item da fila`, `Revisar conflito` | `RunFullSyncUseCase` (`ProcessSyncQueueUseCase` + `PullRemoteAnimalsUseCase` + `PullRemoteInterestsUseCase`) | `sync_queue`, `sync_metadata`, `animals`, `favorites`, `adoption_interests` |
| **V14 • `conflito/[id].tsx`** | `Manter minha edição`, `Usar versão online` | `ResolveSyncConflictUseCase`, `RunFullSyncUseCase` | `animals`, `sync_queue` |
| **V15 • `moderacao.tsx`** | `Ocultar`, `Reexibir` | `ModerateAnimalUseCase` (`AccessPolicy.canModerate`) | `animals` (`moderation_status`), `animal_tombstones` |
| **Decisão 20 • `notificacoes.tsx`** | `Toque no item do feed`, `Pull-to-Refresh` | `AppStateRepository` (`notifications_last_seen`), `RunFullSyncUseCase` | `app_state`, `adoption_interests`, `sync_queue` |
