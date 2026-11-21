# 08 - Expo Location e Mapas

[Índice e convenções](README.md) · [Checklist](06-checklist-de-revisao.md)

## 1. Origem e objetivo

Fonte principal: **S6 - `02-expo-location-maps.pdf`**.

| Páginas de S6 | Conteúdo adaptado |
| --- | --- |
| 4-7 | Setup: bibliotecas (expo-location, react-native-maps, expo-task-manager, expo-sqlite), app.json permissões e chaves, APIs do Google Cloud |
| 9-18 | expo-location: fluxo de localização, permissões, posição atual, accuracy, última posição vs atual, watchPositionAsync, hook useLocation, geocoding/reverse geocoding, permissões por plataforma, localização em segundo plano |
| 22-29 | react-native-maps: MapView, props, controle por ref, Marker, boas práticas, Polyline, outras camadas (Circle, Polygon, UrlTile) |
| 31-38 | Rotas e busca: MapViewDirections, props, resultado da rota, segurança da chave do Google, GooglePlacesAutocomplete, armadilhas comuns |
| 40-43 | Persistência e segurança: fila offline com expo-sqlite, sincronização em lote, segurança em localização, arquitetura do app da série |

Objetivo: definir critérios para capturar posição, exibir em mapa, rotear e buscar lugares no app móvel com Expo. O exemplo da aula é um app de rastreio de trilhas com mapa, busca de lugares e rotas. O Enlace tem localização aproximada de anúncios e mapa opcional, exigindo adaptação de escopo.

## 2. Setup, permissões e chaves de API

### LOC-01 - Configurar bibliotecas, permissões e chaves antes de usar localização

**Aula:** S6, pp. 4-7. Bibliotecas da aula:

| Biblioteca | Uso |
| --- | --- |
| expo-location | GPS, permissões, geocoding |
| react-native-maps | MapView, Marker, Polyline |
| react-native-maps-directions | Rota desenhada no mapa |
| react-native-google-places-autocomplete | Busca de lugares com sugestões |
| expo-task-manager | Tarefas em segundo plano |
| expo-sqlite | Fila offline local |

Instalação:

```bash
npx expo install expo-location
npx expo install react-native-maps
npx expo install expo-task-manager expo-sqlite
npm install react-native-maps-directions
npm install react-native-google-places-autocomplete
```

`app.json` configura permissões e chaves:

```json
{ "expo": {
  "plugins": [["expo-location", {
    "locationWhenInUsePermission":
      "Usamos sua posição para mostrar o mapa."
  }]],
  "ios": { "config": {
    "googleMapsApiKey": "SUA_CHAVE" } },
  "android": { "config": { "googleMaps": {
    "apiKey": "SUA_CHAVE" } } }
}}
```

APIs do Google Cloud: Maps SDK (renderiza mapa Android/iOS), Directions API (rotas), Places API (autocomplete e detalhes). Restrições: limitar a chave por app e por API.

**Complemento de implementação:** chaves de API no app.json ficam no bundle e podem ser extraídas. Restringir por package/bundle ID e API habilitada. Definir cotas e alertas de orçamento. Considerar proxy no servidor (Edge Function do Supabase) para evitar expor a chave no cliente.

**Aplicação ao Enlace:** se mapa for opcional, configurar apenas quando necessário. Chave do Google Maps só se houver mapa; caso contrário, não instalar dependências desnecessárias.

**Verificar:** permissões declaradas em `app.json` correspondem aos recursos usados; chaves não estão em texto puro no código-fonte; build testado inclui as configurações nativas.

### LOC-02 - Pedir permissão de localização no momento de uso

**Aula:** S6, pp. 9-13. Fluxo correto: verificar serviços (hasServicesEnabledAsync) → pedir permissão (requestForegroundPermissionsAsync) → ler posição (getCurrentPositionAsync ou monitorar) → tratar negação/erro/accuracy.

`getCurrentPositionAsync` mede agora (demora mais, gasta bateria). `getLastKnownPositionAsync` é imediata mas pode ser antiga ou nula (ótima para abrir o mapa rápido).

Accuracy x bateria:

| Nível | Precisão aprox. |
| --- | --- |
| Lowest | ~3 km |
| Low | ~1 km |
| Balanced | ~100 m |
| High | ~10 m |
| Highest / BestForNavigation | melhor possível |

Hook `useLocation` exemplo: pedir permissão, se negada definir erro, senão `watchPositionAsync` com `accuracy: High` e `distanceInterval: 10`, limpar inscrição ao desmontar (`sub.remove()`).

Geocoding/reverse geocoding via expo-location:

```ts
// endereço -> coordenadas
const [r] = await Location.geocodeAsync("Av. Brasil, 1000, BH");
// coordenadas -> endereço
const [end] = await Location.reverseGeocodeAsync({ latitude, longitude });
```

**Complemento de implementação:** não pedir permissão de localização na inicialização do app; pedir somente quando o usuário acionar o recurso. Tratar `canAskAgain === false` abrindo configurações (`Linking.openSettings()`). Não usar `Highest` se `Balanced` for suficiente.

**Aplicação ao Enlace:** localização só quando o usuário cria/edita um anúncio e opta por usar a posição atual. Não rastrear em segundo plano sem justificativa explícita.

**Verificar:** permissão é pedida no contexto da ação, não na abertura do app; negação não quebra o app; `getLastKnownPositionAsync` usada para abertura rápida do mapa quando disponível.

### LOC-03 - Monitorar posição com watchPositionAsync e limpar inscrições

**Aula:** S6, pp. 14-16. `watchPositionAsync(opções, callback)` recebe atualizações contínuas. Opções: `accuracy`, `distanceInterval` (metros), `timeInterval` (ms, só Android). Ao desmontar o componente, chamar `sub.remove()` para parar o monitoramento e evitar vazamento de bateria.

**Complemento de implementação:** sempre remover a inscrição no cleanup do `useEffect` ou `useFocusEffect`. Não deixar múltiplas inscrições ativas simultaneamente para o mesmo propósito. Definir `distanceInterval` adequado para evitar atualizações excessivas.

**Aplicação ao Enlace:** monitoramento contínuo não está no escopo principal; se usado (ex.: mostrar distância até o anúncio), limpar ao sair da tela.

**Verificar:** nenhuma inscrição de `watchPositionAsync` permanece após desmontar a componente; múltiplas telas não iniciam monitores concorrentes desnecessários.

### LOC-04 - Tratar permissões e diferenças entre iOS e Android

**Aula:** S6, pp. 18-20. iOS: texto de uso obrigatório; permissão While Using / Always. Android: FINE (precisa) e COARSE (aproximada); usuário escolhe. Negado com `canAskAgain === false`: abrir `Linking.openSettings()`.

Localização em segundo plano: pedir `requestBackgroundPermissionsAsync`, `defineTask` no escopo global, `startLocationUpdatesAsync`. Exige development build e justificativa nas lojas. Android: notificação fixa obrigatória.

**Complemento de implementação:** localização em segundo plano tem custo de bateria elevado e requer justificativa nas lojas de aplicativo. Usar somente se o requisito do produto exigir. Preferir foreground quando suficiente.

**Aplicação ao Enlace:** localização em segundo plano não é necessária para anúncios de adoção; usar apenas foreground no momento de criação/edição.

**Verificar:** não há uso de `requestBackgroundPermissionsAsync` ou `startLocationUpdatesAsync` sem justificativa documentada; textos de permissão em `app.json` estão preenchidos.

## 3. MapView, marcadores e rotas

### LOC-05 - Usar MapView com props adequadas e controle por ref

**Aula:** S6, pp. 22-24. MapView básico:

```tsx
<MapView
  style={{ flex: 1 }}
  provider={PROVIDER_GOOGLE}
  initialRegion={{
    latitude: -21.5561, longitude: -45.4345,
    latitudeDelta: 0.05, longitudeDelta: 0.05,
  }}
  showsUserLocation
  showsMyLocationButton
/>
```

Principais props: `initialRegion`/`region` (área visível, solta/controlada), `onRegionChangeComplete`, `mapType` (standard, satellite, hybrid), `showsUserLocation`, `onPress` (nativeEvent.coordinate), `onMapReady`.

Controle por ref: `animateToRegion`, `fitToCoordinates([origem, destino], { edgePadding, animated })`.

**Complemento de implementação:** `latitudeDelta` e `longitudeDelta` têm escalas diferentes (ver GEO-01). `showsUserLocation` exige permissão de localização concedida. Não forçar re-render do mapa a cada mudança de região; usar `region` controlada com cuidado.

**Aplicação ao Enlace:** mapa pode mostrar localização aproximada do anúncio. Se o mapa for opcional, renderizar condicionalmente para evitar carregar dependências pesadas quando não necessário.

**Verificar:** região inicial é coerente com as coordenadas exibidas; mapa não é montado quando o recurso não está ativo; controle por ref funciona para centralizar em pontos de interesse.

### LOC-06 - Usar Marker com boas práticas de desempenho

**Aula:** S6, pp. 25-27. Marker: coordenadas, título, descrição, `pinColor`, `draggable`, `onPress`, `onDragEnd`. Callout: popup de título e descrição. Marcador customizado: filhos do Marker ou prop `image`.

Boas práticas: `tracksViewChanges={false}` evita redesenho e economiza CPU. Muitos Markers com views customizadas são o gargalo mais comum de mapas. Centenas de pontos: usar clustering. Sempre definir `key` única na lista.

Adicionar pontos ao tocar: `onPress={(e) => setPontos([...p, e.nativeEvent.coordinate])}`.

**Complemento de implementação:** não usar `key={index}` em listas dinâmicas de marcadores; usar ID estável. Para muitos pontos, considerar clustering ou simplificação de geometria.

**Aplicação ao Enlace:** marcadores podem indicar anúncios próximos ou localização do usuário. Não exibir centenas de marcadores simultâneos sem clustering.

**Verificar:** quantidade de marcadores é razoável para o dispositivo; `key` é estável e único; marcadores não exibem precisão maior que a intencional.

### LOC-07 - Desenhar Polyline e outras camadas do mapa

**Aula:** S6, pp. 28-29. Polyline: trilha do usuário, com `coordinates`, `strokeColor`, `strokeWidth`. Outras camadas: Circle (centro + raio em metros, geofence visual), Polygon (área fechada com fillColor), UrlTile (tiles customizados), `animateCamera` (zoom, inclinação, heading).

**Complemento de implementação:** polilhas com muitos pontos consomem memória; simplificar ou decimiar se necessário. `geodesic={true}` para longas distâncias segue a curvatura da Terra.

**Aplicação ao Enlace:** trilha ou rota entre pontos é opcional. Se usada, manter o número de pontos controlado.

**Verificar:** polylines não acumulam pontos indefinidamente; camadas visuais são removidas quando não mais necessárias.

### LOC-08 - Usar MapViewDirections e Places Autocomplete com chave restrita

**Aula:** S6, pp. 31-38. MapViewDirections:

```tsx
<MapViewDirections
  origin={origem}
  destination={destino}
  apikey={GOOGLE_KEY}
  mode="DRIVING"
  strokeWidth={5}
  strokeColor="#0E8F8C"
  onError={(e) => console.warn(e)}
/>
```

Props: `origin`/`destination` (LatLng ou texto), `waypoints`, `mode` (DRIVING, WALKING, BICYCLING, TRANSIT), `optimizeWaypoints`, `onReady` (distance, duration, coordinates).

Segurança da chave do Google: chave no app fica no bundle e pode ser extraída. Restringir por package/bundle ID e por API habilitada. Usar proxy (Edge Function do Supabase) para chamar a API do servidor. Definir cotas e alertas de orçamento.

GooglePlacesAutocomplete:

```tsx
<GooglePlacesAutocomplete
  placeholder="Para onde?"
  fetchDetails
  query={{ key: GOOGLE_KEY, language: "pt-BR", components: "country:br" }}
  onPress={(data, details) => {
    const { lat, lng } = details!.geometry.location;
    setDestino({ latitude: lat, longitude: lng });
  }}
/>
```

Props: `query` (key, language, components), `fetchDetails` (traz coordenadas no onPress), `minLength`/`debounce` (menos chamadas e menos custo), `styles`, `textInputProps`.

Integração: digitar → sugestões do Places → selecionar → mover mapa e marcar → rotear. Origem: posição do expo-location. Destino: lugar escolhido.

Armadilhas: evitar autocomplete dentro de ScrollView/FlatList; `keyboardShouldPersistTaps="handled"`; posicionar camadas absoluto no topo com zIndex; debounce e minLength de 3 caracteres.

**Complemento de implementação:** nunca expor chave do Google Maps/Places diretamente no app. Usar debounce para reduzir chamadas. Tratar `onError` de rotas e exibir mensagem compreensível.

**Aplicação ao Enlace:** busca de lugares e roteamento são opcionais. Se implementados, usar chave restrita via proxy e considerar custo por chamada.

**Verificar:** chave do Google não está exposta no cliente; chamadas de Places/Directions têm debounce e minLength; erros de rota são tratados com feedback ao usuário.

## 4. Persistência offline e segurança de localização

### LOC-09 - Gravar posição localmente e sincronizar em lote

**Aula:** S6, pp. 40-41. Fila offline com expo-sqlite:

```ts
import * as SQLite from "expo-sqlite";
const db = await SQLite.openDatabaseAsync("geo.db");
await db.execAsync(`CREATE TABLE IF NOT EXISTS fila (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  lat REAL, lng REAL, acc REAL, ts INTEGER,
  enviado INTEGER DEFAULT 0);`);
await db.runAsync(
  "INSERT INTO fila (lat,lng,acc,ts) VALUES (?,?,?,?)",
  [c.latitude, c.longitude, c.accuracy ?? 0, ts]);
```

Sincronização em lote:

```ts
const pend = await db.getAllAsync(
  "SELECT * FROM fila WHERE enviado = 0 LIMIT 100");
if (pend.length) {
  const { error } = await supabase
    .from("track_points").insert(pend.map(toRow));
  if (!error) await db.runAsync(
    "UPDATE fila SET enviado = 1 WHERE id <= ?",
    [pend[pend.length - 1].id]);
}
```

**Complemento de implementação:** `enviado = 0/1` simplifica o aula; fluxos reais precisam representar pendências, falhas e reenvio adequadamente (ver OFF-03 a OFF-07). Não marcar como enviado antes de confirmação remota.

**Aplicação ao Enlace:** se houver histórico de localização do usuário, usar fila offline semelhante. Para anúncios, a localização é gravada uma vez no cadastro/edição, não como tracking contínuo.

**Verificar:** fila offline preserva pontos sem rede; sincronização em lote não marca como enviado sem confirmação; reenvio não duplica registros.

### LOC-10 - Aplicar boas práticas de segurança em localização

**Aula:** S6, pp. 42-43. Segurança em localização:

| Aspecto | Recomendação |
| --- | --- |
| Permissão mínima | Foreground primeiro; background só se necessário |
| Chaves | Restritas e fora do repositório |
| Mock location | Android: `loc.mocked` indica posição simulada |
| Retenção | Apagar histórico antigo; permitir excluir tudo |
| Em trânsito | Sempre HTTPS/TLS |
| Transparência | Explicar o uso e permitir revogar |

Arquitetura do app da série: expo-location (posição e permissões) → SQLite (fila offline) → Supabase (Auth, banco, RLS) → Mapa (Marker, Polyline, rota).

**Complemento de implementação:** detectar mock location se a confiança na posição for crítica. Não confiar cegamente em coordenadas do cliente para decisões sensíveis sem validação.

**Aplicação ao Enlace:** localização do anúncio é fornecida pelo usuário, não rastreada continuamente. Não usar mock location para falsificar localização de anúncio.

**Verificar:** permissão mínima é usada; chaves de API estão restritas; histórico de localização tem retenção definida; comunicação usa HTTPS/TLS.

## 5. Critérios de avaliação da aula aplicados à auditoria

S6, pp. 43, organiza o resumo da aula. No Enlace, procurar evidências correspondentes:

- Setup: bibliotecas instaladas, permissões em app.json, chaves restritas.
- expo-location: permissão no momento certo, accuracy mínima, watchPositionAsync com sub.remove(), geocoding/reverse geocoding.
- Mapas: MapView, Marker com boas práticas, Polyline, outras camadas apenas se necessárias.
- Rotas/busca: MapViewDirections e Places com chave restrita, debounce, tratamento de erro.
- Persistência: fila offline com expo-sqlite, sincronização em lote, sucesso parcial tratado.
- Segurança: permissão mínima, chaves fora do app, retenção, HTTPS/TLS.

O app de rastreio de trilhas apresentado na aula é uma atividade de referência, não a especificação funcional do Enlace. O [checklist](06-checklist-de-revisao.md) traduz estes critérios em verificações sem presumir o resultado.
