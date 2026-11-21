# 07 - Fundamentos de Geolocalização

[Índice e convenções](README.md) · [Checklist](06-checklist-de-revisao.md)

## 1. Origem e objetivo

Fonte principal: **S5 - `01-fundamentos-geolocalizacao.pdf`**.

| Páginas de S5 | Conteúdo adaptado |
| --- | --- |
| 4-7 | O que é geolocalização, WGS84, latitude/longitude, graus decimais, graus e distâncias reais |
| 9-20 | Posicionamento: GPS, GNSS, Cell ID, Wi-Fi, fusão de sensores, acurácia, precisão, métricas de qualidade |
| 22-27 | Mapas digitais: projeções, Web Mercator, Region, Markers, Polylines, formas de representar rotas |
| 29-35 | Roteamento e geocoding: algoritmos, resposta de API, encoded polyline, geocoding, reverse geocoding, Places |
| 37-41 | Persistência de dados geoespaciais: onde guardar, modelo PostGIS, consulta espacial, estratégias de tracking, retenção |
| 43-46 | Segurança e privacidade: dados sensíveis, princípios de proteção, LGPD, checklist do app |

Objetivo: definir critérios para representar, capturar, armazenar e proteger dados de localização no app móvel. O exemplo da aula é um app de rastreio de trilhas. O Enlace tem anúncios de adoção com localização aproximada, o que exige adaptar a granularidade e a exposição dos dados de posição.

## 2. Coordenadas e representação de posição

### GEO-01 - Usar WGS84 e graus decimais para coordenadas

**Aula:** S5, pp. 6-7. A geolocalização expressa a posição na superfície terrestre em latitude (-90° a +90°) e longitude (-180° a +180°), em graus decimais, não em graus/minutos/segundos. O Brasil fica aproximadamente entre -5° e -33° de latitude e -28° e -74° de longitude. Altitude é medida em metros acima do nível do mar.

1° de latitude equivale a ~111 km em qualquer lugar. 1° de longitude equivale a ~111·cos(lat) km, "encolhendo" conforme se afasta do Equador (~101 km em São Paulo). Por isso `latitudeDelta` e `longitudeDelta` do mapa têm escalas diferentes.

**Complemento de implementação:** graus decimais são fáceis de comparar e serializar, mas requerem cuidado com precisão de ponto flutuante. Armazenar com casas decimais suficientes para a granularidade necessária. Não confundir ordem (latitude, longitude) com (longitude, latitude) ao inserir em APIs ou banco — PostGIS espera `ST_MakePoint(longitude, latitude)`.

**Aplicação ao Enlace:** localização de anúncio pode ser aproximada (bairro/cidade), sem necessidade de coordenadas exatas da residência. Se houver campo de localização, definir a precisão mínima compatível com a funcionalidade de busca por proximidade.

**Verificar:** coordenadas estão no intervalo válido; ordem latitude/longitude está consistente entre app, banco e APIs externas.

### GEO-02 - Escolher a fonte de posicionamento adequada ao caso de uso

**Aula:** S5, pp. 9-17. Fontes de posicionamento:

| Fonte | Precisão | Ambiente interno | Bateria |
| --- | --- | --- | --- |
| GPS/GNSS | 5–10 m | Ruim | Alto |
| Wi-Fi (RSSI) | 10–50 m | Bom | Médio |
| Cell ID | 500 m–5 km | Bom | Baixo |

GPS depende de ≥4 satélites e trilateração; o relógio do receptor é impreciso, exigindo o 4º satélite. Fatores que afetam precisão: PDOP (geometria dos satélites), ionosfera, troposfera, multipath, obstrução do céu. GNSS inclui GPS (EUA), GLONASS (Rússia), Galileo (Europa), BeiDou (China), SBAS (geoestacionários). Fusão de sensores (Kalman Filter, Particle Filter) integra GPS, Wi-Fi, Cell ID, acelerômetro e giroscópio para reduzir ruído e saltos.

Métricas de qualidade da posição: latitude, longitude, accuracy (raio de confiança em metros, CEP), altitude/altitudeAccuracy, heading (azimuto [0,360)), speed (m/s), timestamp (UTC).

Interpretando `accuracy`: <5 m excelente (GPS+Wi-Fi/Cell), ~50 m círculo de confiança (68%), ~1000 m ruim (provavelmente Cell ID), <0 inválido/indisponível.

**Complemento de implementação:** descartar leituras com `accuracy` alta demais para o caso de uso. Não assumir que a primeira leitura é a mais precisa; pode haver aquecimento do GPS (TTFF). Tratar `accuracy` negativo ou nulo como indisponível.

**Aplicação ao Enlace:** localização aproximada de anúncio (nível bairro/cidade) pode ser obtida com Wi-Fi/Cell ID, economizando bateria. Não exigir GPS de alta precisão se a funcionalidade for apenas "anúncios próximos".

**Verificar:** precisão obtida é suficiente para o recurso; leituras inválidas são descartadas; usuário não é rastreado continuamente sem necessidade.

### GEO-03 - Interpretar acurácia, precisão e erros de medição

**Aula:** S5, pp. 18-20. Acurácia é proximidade do valor estimado ao verdadeiro; precisão é consistência e reprodutibilidade. Erro sistemático é viés constante (ex.: GPS sempre 10 m ao norte); erro aleatório é variação randômica.

**Complemento de implementação:** distinguir acurácia de precisão ao definir limites de aceitação. Uma leitura precisa (consistente) pode não ser acurada; uma leitura acurada em média pode variar muito entre medições.

**Aplicação ao Enlace:** ao buscar anúncios por proximidade, considerar o raio de `accuracy` para evitar excluir resultados válidos por margem de erro.

**Verificar:** limite de distância na busca por proximidade considera a margem de erro da posição do usuário e dos anúncios.

### GEO-04 - Definir a região visível, marcadores e polilinhas no mapa

**Aula:** S5, pp. 22-27. Projeções cartográficas: conformal (preserva ângulos, Mercator), equal-area (preserva áreas), equidistant (preserva distâncias), compromise (balanceia distorções). Web Mercator (EPSG:3857) é o padrão de fato (Google Maps, Mapbox): `x = longitude`, `y = ln(tan(π/4 + latitude/2))`, preserva ângulos, mas exagera áreas perto dos polos.

`Region` define a área visível: `latitude`, `longitude` (centro), `latitudeDelta`, `longitudeDelta` (dimensões em graus).

`Marker` desenha ponto com coordenadas, ícone/cor, callout (popup), eventos (onPress, onDragStart, onDragEnd). Uso: usuário (azul), destino (verde), POI, resultado de busca.

`Polyline` desenha linhas e rotas entre coordenadas, com `strokeWidth`, `strokeColor`, `lineDashPattern`, `geodesic`.

Formas de representar rota: polyline simples (rápida, imprecisa), polyline detalhada (mais precisa, mais memória), GeoJSON LineString (interoperável, precisa parsing), Encoded Polyline (compacto na rede, precisa decodificar — ~10x menor que JSON para 100 pontos).

**Complemento de implementação:** `latitudeDelta` e `longitudeDelta` têm escalas diferentes devido à projeção; calcular dimensões visuais considerando a latitude. Marcadores em quantidade elevada exigem clustering para desempenho.

**Aplicação ao Enlace:** mapa pode mostrar localização aproximada do anúncio e destino. Não exibir endereço exato nem coordenadas precisas de usuários sem consentimento explícito.

**Verificar:** região do mapa é coerente com as coordenadas exibidas; marcadores não vazam precisão maior que a intencional.

### GEO-05 - Usar roteamento e geocoding com consciência de custo e precisão

**Aula:** S5, pp. 29-35. Roteamento calcula caminhos entre pontos em malha de ruas conectadas, considerando sentidos, velocidades, restrições (pedágio, trânsito) e preferências. Algoritmos: Dijkstra (caminho mais curto, O(n log n)), A* (Dijkstra + heurística), Contraction Hierarchies (pré-processa rede, consultas em ms), roteamento dinâmico (ajusta custos com trânsito em tempo real).

Resposta de API de rotas inclui `routes[].legs[].distance`, `.duration`, `.steps[].polyline.points` (encoded). Encoded Polyline (Google) quantiza coordenadas (escala 1e5), guarda deltas, codifica inteiros de tamanho variável — ~10x menor que JSON para 100 pontos (~50 bytes vs ~500 bytes).

Geocoding: endereço → coordenadas, com níveis de precisão: rooftop > range_interpolated > geometric_center > approximate. Reverse geocoding: coordenadas → endereço legível, hierarquia rua → bairro → cidade → estado → país. Places: `place_id` identifica lugares (não só endereços), com detalhes via `place_id`.

**Complemento de implementação:** chaves de API de roteamento/geocoding têm custo e precisam de restrição (por app/API) e cotas de orçamento. Não expor chave direta no app; considerar proxy no servidor (Edge Function). Decodificar polylines antes de renderizar.

**Aplicação ao Enlace:** roteamento entre anúncios ou até o local de adoção é opcional. Se implementado, usar chave restrita e considerar custo por chamada. Geocoding pode converter endereço do usuário em coordenadas aproximadas para busca.

**Verificar:** chamadas de roteamento/geocoding são limitadas e tratam erro; chave não está exposta no cliente; resultados são usados apenas para o propósito declarado.

### GEO-06 - Escolher onde persistir dados geoespaciais

**Aula:** S5, pp. 37-41. Desafios: volume (apps de tracking geram milhões de pontos), performance (consultas espaciais: pontos em 1 km), índices (alguns bancos não têm tipos geoespaciais), privacidade (dados extremamente sensíveis).

Camadas de armazenamento:

| Camada | Uso | Limite |
| --- | --- | --- |
| AsyncStorage / MMKV | Preferências, último ponto | Chave-valor |
| expo-sqlite | Fila offline, histórico local | Sem tipo espacial nativo |
| Postgres + PostGIS | Fonte da verdade no servidor | Precisa de rede |
| GeoHash / Firestore | Busca por célula | Menos flexível |

Modelo PostGIS:

```sql
create extension if not exists postgis;

create table track_points (
  id bigint generated always as identity primary key,
  track_id uuid not null,
  geom geography(Point, 4326) not null,
  accuracy real,
  recorded_at timestamptz not null
);
create index on track_points using gist (geom);
```

Consulta espacial (pontos em raio de 1 km):

```sql
select id, name
from places
where ST_DWithin(
  geom,
  ST_MakePoint(-45.4345, -21.5561)::geography,
  1000
);
-- ATENÇÃO: MakePoint(LONGITUDE, LATITUDE)
```

Estratégias de tracking: amostragem (gravar por distância mínima, ex.: 10 m, não por tempo), batching (enviar pontos em lote), offline-first (gravar local e sincronizar depois), retenção (apagar dados antigos após prazo definido).

**Complemento de implementação:** expo-sqlite não tem tipo espacial nativo; consultas de proximidade no cliente exigem cálculo em memória ou índice simples. PostGIS no servidor é mais adequado para buscas espaciais complexas. Não confundir `geography` (esfera, metros) com `geometry` (plano).

**Aplicação ao Enlace:** localização de anúncio pode ser armazenada localmente e sincronizada. Busca por proximidade no servidor pode usar PostGIS ou, alternativamente, filtragem simples por coordenadas se o escopo for limitado.

**Verificar:** tipo de dado usado para coordenadas é consistente; consulta espacial considera a ordem longitude/latitude; retenção de histórico de localização está definida.

### GEO-07 - Proteger dados de localização conforme LGPD e princípios de privacidade

**Aula:** S5, pp. 43-46. Dados de localização revelam residência, trabalho, saúde, religião e rotinas. São dado pessoal (e podem virar sensível) pela LGPD. Art. 13-14: documentar o tratamento. Princípios:

- Minimização: coletar só o necessário; retenção limitada
- Anonimização: separar ID do usuário, UUID temporário, hash
- Criptografia: HTTPS/TLS em trânsito; SQLite cifrado (SQLCipher)
- Consentimento: permissão explícita, explicar uso, revogável
- Auditoria: registrar acessos e detectar anomalias

LGPD: dados de crianças exigem consentimento específico. Boa prática: política de privacidade clara e botão para excluir os dados.

Checklist do app:
- Pedir permissão no momento de uso, com justificativa
- Preferir localização aproximada quando basta
- Chaves de API restritas; segredos fora do app
- RLS no banco: cada usuário vê só o seu
- Tokens no SecureStore, nunca em texto puro

**Complemento de implementação:** localização é dado sensível; minimizar coleta e retenção. Oferecer mecanismo de exclusão de dados. Não armazenar histórico de localização desnecessário.

**Aplicação ao Enlace:** localização aproximada de anúncio (bairro/cidade) é suficiente; não coletar endereço exato nem coordenadas precisas do usuário. Permitir excluir dados de localização. Justificar a coleta ao pedir permissão.

**Verificar:** justificativa de permissão está clara; localização aproximada é usada quando suficiente; dados podem ser excluídos pelo usuário; chaves de API estão restritas.

## 3. Critérios de avaliação da aula aplicados à auditoria

S5, pp. 44-46, organiza o checklist de privacidade e segurança. No Enlace, procurar evidências correspondentes:

- Fundamentos: coordenadas válidas, WGS84, graus decimais, acurácia interpretada.
- Posicionamento: fonte adequada ao caso de uso, precisão suficiente, leituras inválidas descartadas.
- Mapas: região coerente, marcadores sem exposição desnecessária, rotas apenas se exigidas.
- Roteamento/geocoding: chamadas limitadas, chave restrita, custo considerado.
- Persistência: camada adequada ao volume, tipo espacial quando necessário, retenção definida.
- Segurança/privacidade: permissão justificada, minimização, consentimento, exclusão, ausência de segredos no cliente.

O projeto de rastreio de trilhas apresentado na aula é uma atividade de referência, não a especificação funcional do Enlace. O [checklist](06-checklist-de-revisao.md) traduz estes critérios em verificações sem presumir o resultado.
