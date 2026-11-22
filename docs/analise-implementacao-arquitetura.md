# Análise de Implementação — Arquitetura do Enlace

Este documento consolida a análise do projeto Enlace com base nos novos arquivos de arquitetura criados em `docs/arquitetura/`:

- `07-fundamentos-geolocalizacao.md` (GEO-01 a GEO-07)
- `08-expo-location-e-mapas.md` (LOC-01 a LOC-10)
- `09-supabase-backend-seguro.md` (SUP-01 a SUP-07)

Ele classifica o que **DEVE** ser implementado (itens em aberto, necessários para coerência com a arquitetura e o escopo do projeto), o que **PODE** ser implementado (melhorias opcionais alinhadas aos documentos de arquitetura) e o que **NÃO deve** ser implementado (fora de escopo).

---

## Contexto do Enlace (estado atual)

O app já cobre boa parte da teoria dos novos PDFs:

- **Geolocalização pontual** (`src/infrastructure/device/location/LocationAdapter.ts`): `expo-location` com `requestForegroundPermissionsAsync`, `getCurrentPositionAsync`, `reverseGeocodeAsync`, coordenadas arredondadas a 3 casas decimais (~110 m, Decisão D8), sem rua/número, permissão solicitada somente no momento de uso. Textos de justificativa em `app.json` (iOS/Android). Validação de `accuracy` implementada; feedback de falha de geocodificação reversa implementado.
- **Supabase seguro**: cliente com `SessionStorageSecureStore` (cifra sessão), `detectSessionInUrl: false`, RLS habilitada em todas as tabelas, políticas restritas por `auth.uid()`, bucket `animal-photos` público, `AuthContext` com rotas protegidas (`expo-router`).
- **Offline-first**: SQLite local, fila de sync, cursor delta, resolução de conflitos, tombstones e atualização manual por gesto (Pull-to-Refresh com `RefreshControl` nas listas principais).
- **Mapa real**: implementado com `react-native-maps`, `MapView` com `Marker` por anúncio nas coordenadas `latitude_approx` / `longitude_approx` já armazenadas; `app.json` configurado com plugin `react-native-maps` (chave placeholder a ser preenchida pela equipe).
- **Ausentes**: `react-native-maps-directions`, `react-native-google-places-autocomplete`, `expo-task-manager`, chaves reais do Google Maps, Edge Functions.

---

## O que DEVE ser implementado

Todos os itens da seção "DEVE ser implementado" da análise anterior foram concluídos:

| Item | Status |
|------|--------|
| 1. Validar `accuracy` da leitura de GPS (GEO-03) | ✅ Concluído |
| 2. Mapa real com `react-native-maps` (LOC-05 / GEO-04) | ✅ Concluído |
| 3. Feedback de falha de geocodificação reversa (GEO-05 / LOC-02) | ✅ Concluído |

Não há mais itens obrigatórios pendentes nesta análise.

---

## O que PODE ser implementado (opcional)

São melhorias alinhadas aos documentos de arquitetura, mas não críticas para o escopo atual.

| Item | Doc(s) | O que é | Por que é opcional |
|------|--------|---------|-------------------|
| **Places Autocomplete** | LOC-08 | `GooglePlacesAutocomplete` para sugerir bairro/cidade ao digitar | Facilita preenchimento, mas o preenchimento manual já funciona. |
| **Rota/direções (MapViewDirections)** | LOC-08 | Desenhar caminho do usuário até o animal | Não é requisito de adoção; aumenta custo (API Directions) e complexidade. |
| **Edge Function como proxy para chave do Google** | SUP-06, LOC-08 | Se usar mapas reais, expor a chave via Edge Function do Supabase em vez de no app | Necessário somente se for adotar `react-native-maps` com chave do Google no cliente. |
| **Busca por proximidade no servidor (PostGIS)** | GEO-06 | Mover o cálculo de distância (atualmente client-side via Haversine) para SQL com `ST_DWithin` | Só se o volume de anúncios crescer e o filtro client-side ficar lento. Hoje é viável no cliente. |
| **Botão "Excluir meus dados de localização"** | GEO-07 (LGPD) | Permitir o usuário apagar histórico/localização associada | Boa prática de privacidade, mas o Enlace não faz tracking contínuo, apenas grava localização do anúncio. |
| **URLs assinadas (`createSignedUrl`)** | SUP-05 | Acesso temporário a fotos privadas | Não se aplica hoje: bucket é público e fotos de anúncios são públicas. Só se houver fotos privadas/rascunhos no futuro. |

---

## O que NÃO deve ser implementado (fora de escopo)

Conforme os próprios documentos de arquitetura e o contexto do Enlace:

- **Localização em segundo plano / tracking contínuo** (`expo-task-manager`, `startLocationUpdatesAsync`): não faz sentido para adoção de animais. O Enlace usa localização pontual só na criação/edição de anúncio. (LOC-04, GEO-06)
- **Vídeo, QR Code, reconhecimento por IA**: não estão no escopo. (já tratados como NA no checklist de revisão)
- **Upload resumível (TUS), CRDT, motor externo de sync**: alternativas para necessidades específicas, não requisitos universais.

---

**Observação:** este documento é uma proposta de análise baseada nos documentos de arquitetura e na inspeção do código. As decisões finais cabem à equipe de produto.
