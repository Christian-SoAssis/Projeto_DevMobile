# Análise de Implementação — Arquitetura do Enlace

Este documento consolida a análise do projeto Enlace com base nos novos arquivos de arquitetura criados em `docs/arquitetura/`:

- `07-fundamentos-geolocalizacao.md` (GEO-01 a GEO-07)
- `08-expo-location-e-mapas.md` (LOC-01 a LOC-10)
- `09-supabase-backend-seguro.md` (SUP-01 a SUP-07)

Ele classifica o que **DEVE** ser implementado (itens em aberto, necessários para coerência com a arquitetura e o escopo do projeto), o que **PODE** ser implementado (melhorias opcionais alinhadas aos documentos de arquitetura) e o que **NÃO deve** ser implementado (fora de escopo).

---

## Contexto do Enlace (estado atual)

O app já cobre boa parte da teoria dos novos PDFs:

- **Geolocalização pontual** (`src/infrastructure/device/location/LocationAdapter.ts`): `expo-location` com `requestForegroundPermissionsAsync`, `getCurrentPositionAsync`, `reverseGeocodeAsync`, coordenadas arredondadas a 2 casas decimais (~1,1 km), sem rua/número, permissão solicitada somente no momento de uso. Textos de justificativa em `app.json` (iOS/Android).
- **Supabase seguro**: cliente com `SessionStorageSecureStore` (cifra sessão), `detectSessionInUrl: false`, RLS habilitada em todas as tabelas, políticas restritas por `auth.uid()`, bucket `animal-photos` público, `AuthContext` com rotas protegidas (`expo-router`).
- **Offline-first**: SQLite local, fila de sync, cursor delta, resolução de conflitos, tombstones.
- **Sem mapa real**: a tela inicial tem toggle "Lista / Mapa", mas o mapa é um **mock em CSS** com posições fixas (não usa `react-native-maps`, não usa coordenadas reais dos anúncios).
- **Ausentes**: `react-native-maps`, `react-native-maps-directions`, `react-native-google-places-autocomplete`, `expo-task-manager`, chaves do Google Maps, Edge Functions.

---

## O que DEVE ser implementado

São itens em aberto, necessários para coerência com os documentos de arquitetura e com o escopo do projeto (adoção de animais, anúncios públicos, localização aproximada).

### 1. Validar `accuracy` da leitura de GPS — GEO-03

**Localização:** `src/infrastructure/device/location/LocationAdapter.ts` (linha 47)

O adapter solicita `accuracy: 3` (≈ 10 m), mas **não inspeciona o campo `accuracy` retornado** no objeto `pos.coords`. Não descarta leituras ruins nem avisa o usuário quando a precisão é insuficiente.

**O que fazer:**
- Após `getCurrentPositionAsync`, verificar `pos.coords.accuracy`.
- Se estiver acima de um limite razoável para o caso de uso (ex.: > 100 m), descartar ou alertar que a localização é imprecisa.
- Tratar `accuracy < 0` como indisponível.

---

### 2. Mapa de verdade, ou remover a opção "Mapa" — LOC-05 / GEO-04

**Localização:** `app/(tabs)/index.tsx` (linhas 337-405)

A UI já oferece um toggle Lista/Mapa, mas o mapa é um **desenho em CSS** com pinos em posições fixas (`top: '26%', left: '58%'` etc.), sem relação com as coordenadas reais dos anúncios (`latitude_approx` / `longitude_approx` já armazenadas). Isso é inconsistente com o recurso exposto ao usuário.

**O que fazer (duas opções):**

- **Opção A (recomendada):** instalar `react-native-maps`, configurar chaves do Google Maps em `app.json`, e renderizar os anúncios como `Marker` nas coordenadas já armazenadas. Substituir o mock CSS.
- **Opção B:** remover o toggle "Mapa" e a UI de mapa, mantendo apenas Lista, até que haja decisão de produto para mapa real.

Não é aceitável manter um botão que simula um mapa sem dados reais.

---

### 3. Tratar erro de geocodificação reversa com feedback — GEO-05 / LOC-02

**Localização:** `src/infrastructure/device/location/LocationAdapter.ts` (linhas 55-68)

Se `reverseGeocodeAsync` falhar (offline ou erro), o código mantém valores padrão (`Centro`, `Varginha`) silenciosamente. O usuário não sabe que a localização foi preenchida com fallback.

**O que fazer:**
- Quando a geocodificação reversa falhar, exibir um aviso claro (ex.: "Não foi possível identificar o bairro automaticamente; preencha manualmente") ou marcar o campo como "não identificado", em vez de silenciosamente preencher com padrão.

---

## O que PODE ser implementado (opcional)

São melhorias alinhadas aos documentos de arquitetura, mas não críticas para o escopo atual.

| Item | Doc(s) | O que é | Por que é opcional |
|------|--------|---------|-------------------|
| **Mapa real com `react-native-maps`** | LOC-05, GEO-04 | `MapView` com `Marker` por anúncio, `Polyline` opcional | Só vale a pena se a opção "Mapa" for mantida na UI. Requer chaves do Google Maps. |
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

## Ordem sugerida de implementação

Se você decidir avançar, a ordem lógica seria:

1. **Validar `accuracy`** no `LocationAdapter` (pequeno, baixo risco).
2. **Decidir sobre o mapa:** instalar `react-native-maps` + chaves do Google + substituir o mock, **ou** remover a opção "Mapa" da UI.
3. **Adicionar feedback quando a geocodificação reversa falhar** no `LocationAdapter`.
4. **(Opcional)** Places Autocomplete para preenchimento de endereço.
5. **(Opcional, condicional)** Edge Function como proxy se usar mapa com chave do Google.

---

**Observação:** este documento é uma proposta de análise baseada nos documentos de arquitetura e na inspeção do código. Nenhuma verificação foi executada contra o repositório para comprovar a implementação real de cada item; as decisões finais cabem à equipe de produto.