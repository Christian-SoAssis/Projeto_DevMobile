# 09 - Supabase como Backend Seguro

[Índice e convenções](README.md) · [Checklist](06-checklist-de-revisao.md)

## 1. Origem e objetivo

Fonte principal: **S7 - `03-supabase-backend-seguro.pdf`**. Fonte complementar: S4 para integração com mídia e sincronização.

| Páginas de S7 | Conteúdo adaptado |
| --- | --- |
| 4-7 | Supabase: Postgres, Auth, Storage, API automática, Realtime, Edge Functions; arquitetura de chamada; chaves e credenciais |
| 8 | Cliente Supabase com LargeSecureStore |
| 10-15 | Autenticação: fluxo, métodos (e-mail/senha, magic link, OAuth, MFA), getSession vs getUser, onAuthStateChange, renovação automática |
| 17-21 | Row Level Security (RLS): por que é obrigatória, tabela com RLS, policies por usuário, USING vs WITH CHECK, boas práticas, PostGIS com RPC |
| 24-31 | Storage: tipos de bucket, criação, policy em storage.objects, upload no React Native, URLs de acesso, S3 compatível (somente servidor), recursos adicionais |
| 33-39 | Acesso a WebServices: REST automática (PostgREST), supabase-js consultas, RPC, Edge Function como proxy, Realtime, APIs externas, tratamento de erros de rede |
| 41-53 | Context API e SecureStore: AuthContext, rotas protegidas (expo-router), expo-secure-store, LargeSecureStore, checklist de segurança, arquitetura completa |

Objetivo: definir critérios para autenticação, autorização, armazenamento de arquivos e acesso remoto de forma segura. O exemplo da aula usa Supabase como backend completo. O Enlace já usa Supabase; este documento reforça as regras de segurança que devem ser aplicadas.

## 2. Supabase, arquitetura e credenciais

### SUP-01 - Nunca expor o cliente diretamente ao banco; usar API + RLS

**Aula:** S7, pp. 4-6. Supabase é backend como serviço sobre PostgreSQL, com PostGIS. Entrega: Postgres, Auth (usuários, sessões, OAuth, JWT), Storage (buckets compatíveis S3), API automática (PostgREST), Realtime, Edge Functions (código servidor em TypeScript/Deno).

Arquitetura de uma chamada: App → API (Auth, REST, Storage, Realtime via HTTPS) → Regras (JWT identifica usuário; RLS filtra) → Postgres. **O app nunca fala direto com o banco:** toda chamada passa pela API e pelo RLS.

Chaves e credenciais:

| Chave | Uso | Pode estar no app? |
| --- | --- | --- |
| Project URL | Endereço do projeto; público | Sim |
| Publishable / anon | Vai no app; segura apenas se houver RLS | Sim (com RLS) |
| Secret / service_role | Ignora RLS | **NUNCA** no app |
| JWT do usuário | Identifica quem chama (auth.uid()) | No cliente, como sessão |

**Complemento de implementação:** a chave `anon` não substitui RLS. Sem RLS habilitada e sem policy, qualquer pessoa com a chave lê e altera tudo. Com RLS ligada e sem policy aplicável, acesso é negado (padrão seguro). Regras moram no banco, não no app.

**Aplicação ao Enlace:** o cliente Supabase usa `EXPO_PUBLIC_SUPABASE_URL` e `EXPO_PUBLIC_SUPABASE_KEY`. Nenhuma chave privilegiada (`service_role`) pode estar no cliente.

**Verificar:** `service_role` ou `secret` não aparece no código-fonte, `.env.example`, `.env.local` ou logs; todas as tabelas do schema `public` têm RLS habilitada.

### SUP-02 - Configurar o cliente Supabase com armazenamento de sessão seguro

**Aula:** S7, p. 8. Cliente Supabase:

```ts
import "react-native-url-polyfill/auto";
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_KEY!,
  { auth: {
      storage: new LargeSecureStore(),
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
  } }
);
```

`react-native-url-polyfill` é necessário para o cliente funcionar no React Native.

**Complemento de implementação:** `LargeSecureStore` cifra a sessão com AES-256 e guarda a chave no SecureStore (Keychain/Keystore), o texto cifrado no AsyncStorage. Não usar AsyncStorage puro para tokens. `detectSessionInUrl: false` evita problemas com deep links em mobile.

**Aplicação ao Enlace:** o cliente já usa `LargeSecureStore` via adaptador `SessionStorageSecureStore`. Manter essa abordagem para sessões.

**Verificar:** cliente Supabase usa adaptador de armazenamento seguro; sessão não é persistida em AsyncStorage sem criptografia; `detectSessionInUrl` está desabilitado.

## 3. Autenticação e sessão

### SUP-03 - Gerenciar ciclo de autenticação: cadastro, login, logout, sessão

**Aula:** S7, pp. 10-15. Fluxo: cadastro (criar conta com e-mail/senha) → login (entrar com e-mail/senha) → tokens (access token JWT + refresh token) → renovação automática do JWT vencido. Logout: `signOut` apaga sessão local e invalida refresh token.

Métodos de login: `signInWithPassword` (e-mail/senha), `signInWithOtp` (magic link/sem senha), `signInWithOAuth` / `signInWithIdToken` (OAuth/Google), MFA (segundo fator TOTP para contas sensíveis).

Cadastro/login/logout:

```ts
const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { nome } } });
const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
await supabase.auth.signOut();
```

`getSession()` vs `getUser()`:
- `getSession()`: lê do armazenamento local, rápido, funciona offline, não confiar no resultado no servidor
- `getUser()`: valida o token no servidor Auth, chamada de rede, usar para decisões sensíveis

Escutar mudanças de sessão:

```ts
useEffect(() => {
  const { data } = supabase.auth.onAuthStateChange(
    (evento, sessao) => { setSession(sessao); }
  );
  return () => data.subscription.unsubscribe();
}, []);
```

Renovação e ciclo do app: usar `AppState.addEventListener` para `startAutoRefresh`/`stopAutoRefresh` quando o app entra/sai do foreground.

**Complemento de implementação:** tratar inicialização, expiração e ausência de sessão. Não executar uma pendência de um usuário com a sessão de outro. Listener de auth deve ser limpo quando necessário (unsubscribe).

**Aplicação ao Enlace:** o Enlace já implementa `SupabaseAuthGateway`, `AuthContext` e rotas protegidas. Manter o padrão e validar cada fluxo.

**Verificar:** sessão expirada suspende/recupera operações adequadamente; `signOut` limpa sessão local; listener de auth é removido ao desmontar; decisões sensíveis usam `getUser()` (rede), não `getSession()` (local).

### SUP-04 - Habilitar RLS em todas as tabelas e escrever políticas restritas

**Aula:** S7, pp. 17-21. Por que RLS é obrigatória: a API é exposta e a chave publishable fica no app; sem RLS, qualquer pessoa com a chave lê e altera tudo. Regra de ouro: toda tabela do schema `public` precisa de RLS habilitada.

Tabela com RLS:

```sql
create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid()
    references auth.users(id) on delete cascade,
  nome text not null,
  created_at timestamptz default now()
);
alter table public.tracks enable row level security;
```

Policies por usuário:

```sql
create policy "ler proprias" on public.tracks
  for select to authenticated
  using ( (select auth.uid()) = user_id );

create policy "criar proprias" on public.tracks
  for insert to authenticated
  with check ( (select auth.uid()) = user_id );
```

USING vs WITH CHECK:

| Cláusula | Quando | Comandos |
| --- | --- | --- |
| USING | Filtra linhas já existentes | SELECT, UPDATE, DELETE |
| WITH CHECK | Valida linhas novas ou alteradas | INSERT, UPDATE |

Boas práticas: usar `(select auth.uid())` e indexar `user_id`; restringir papel da policy (`to authenticated`); `security_invoker = true` em views para respeitar RLS; testar com usuários distintos antes de publicar.

PostGIS com RPC:

```sql
create function nearby_places(
  lat float, lng float, raio int)
returns setof places
language sql security invoker as $$
  select * from places
  where ST_DWithin(geom,
    ST_MakePoint(lng, lat)::geography, raio);
$$;
```

**Complemento de implementação:** RLS habilitada sem política aplicável bloqueia acesso pelos papéis sujeitos à RLS (não bloqueia papéis privilegiados que contornam RLS). Testar políticas em conjunto; uma política permissiva adicional pode ampliar o acesso não intencionalmente.

**Aplicação ao Enlace:** o Enlace já tem políticas RLS em `supabase/init.sql` (profiles, animals, animal_photos, favorites, adoption_interests, tombstones). Verificar se todas as tabelas sensíveis têm RLS e políticas adequadas.

**Verificar:** todas as tabelas do schema `public` têm `enable row level security`; políticas restringem acesso a `user_id = auth.uid()` quando apropriado; testes com usuários distintos confirmam isolamento.

### SUP-05 - Usar Storage com buckets privados e políticas específicas

**Aula:** S7, pp. 24-31. Tipos de bucket:

- Público: leitura por URL aberta, ótimo para avatares e imagens do app, CDN e cache
- Privado: acesso por policy ou URL assinada, fotos de usuário e documentos, padrão recomendado

Criando bucket:

```ts
await supabase.storage.createBucket("fotos", {
  public: false,
  fileSizeLimit: "5MB",
  allowedMimeTypes: ["image/jpeg", "image/png"],
});
```

Policy em `storage.objects`:

```sql
create policy "upload na propria pasta"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'fotos'
  and (storage.foldername(name))[1]
      = (select auth.uid())::text
);
```

Upload no React Native:

```ts
const caminho = `${user.id}/${Date.now()}.jpg`;
const { error } = await supabase.storage
  .from("fotos")
  .upload(caminho, decode(base64), {
    contentType: "image/jpeg",
    upsert: false,
  });
```

URLs de acesso:
- Bucket público: `getPublicUrl(caminho)`
- Bucket privado: `createSignedUrl(caminho, 60)` (URL temporária, 60 s)

Storage compatível com S3: endpoint S3 no painel, access keys geradas no painel (ignoram RLS). Ferramentas: AWS SDK, aws cli, rclone, boto3 — **só no servidor**, nunca colocar chaves S3 no app.

Acesso S3 (servidor):

```ts
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
const s3 = new S3Client({
  forcePathStyle: true,
  region: "sa-east-1",
  endpoint: S3_URL,
  credentials: { accessKeyId: ID, secretAccessKey: SECRET },
});
```

Mais recursos: Resumable (TUS) para uploads grandes, transformações (redimensionar imagens na URL), CDN para cache global. No app de trilhas: guardar só o caminho do arquivo no Postgres, não a imagem.

**Complemento de implementação:** uma política de insert no bucket não concede automaticamente select, update ou delete. Reenvios com sobrescrita e remoções precisam das permissões correspondentes. Nome de pasta não substitui política no servidor. Verificar restrições de tipo e tamanho do arquivo. Uma URL assinada expira e não deve ser a única identidade persistida da mídia.

**Aplicação ao Enlace:** bucket `animal-photos` é público no `init.sql`. Definir se fotos publicadas podem ser lidas publicamente e como rascunhos permanecem privados. Não tornar bucket público apenas para contornar imagem que não abriu.

**Verificar:** bucket tem nível de visibilidade adequado ao conteúdo; políticas protegem insert/select/update/delete; URLs assinadas são renovadas por fluxo autorizado; referência estável (`storage_path`) é separada da URL.

### SUP-06 - Usar Edge Functions como proxy para APIs externas e proteger segredos

**Aula:** S7, pp. 33-39. API REST automática (PostgREST): cada tabela vira um endpoint:

```bash
curl "$URL/rest/v1/tracks?select=id,nome" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $JWT"
```

supabase-js consultas:

```ts
const { data, error } = await supabase
  .from("tracks")
  .select("id, nome, track_points(count)")
  .eq("user_id", user.id)
  .order("created_at", { ascending: false })
  .range(0, 19);
```

RPC (Remote Procedure Call):

```ts
const { data, error } = await supabase.rpc(
  "nearby_places",
  { lat: -21.5561, lng: -45.4345, raio: 1000 }
);
```

Edge Function como proxy (ex.: Google Maps):

```ts
// supabase/functions/rota/index.ts
Deno.serve(async (req) => {
  const { origem, destino } = await req.json();
  const key = Deno.env.get("GOOGLE_KEY")!;
  const r = await fetch(montaUrl(origem, destino, key));
  return new Response(await r.text(),
    { headers: { "Content-Type": "application/json" } });
});
```

Realtime: posições ao vivo via `supabase.channel(...).on("postgres_changes", {...}, callback).subscribe()`.

Consumir APIs externas com axios + interceptador de token:

```ts
const api = axios.create({ baseURL: "...", timeout: 10000 });
api.interceptors.request.use(async (cfg) => {
  const { data } = await supabase.auth.getSession();
  const t = data.session?.access_token;
  if (t) cfg.headers.Authorization = `Bearer ${t}`;
  return cfg;
});
```

Tratamento de erros de rede: 401 (token inválido: renovar ou logout), 403/vazio (RLS bloqueou: revisar policy), offline (fila local e nova tentativa), timeout (retry com espera exponencial).

**Complemento de implementação:** Edge Functions rodam no servidor e podem conter segredos (chaves de API externas). Nunca colocar chave de API externa no cliente. Erros de rede precisam de retry com backoff e fila local para offline.

**Aplicação ao Enlace:** se houver integração com Google Maps/Places, usar Edge Function como proxy para não expor a chave no cliente. Realtime pode ser usado para atualizações de anúncios se fizer sentido.

**Verificar:** chaves de API externas não estão no cliente; Edge Functions são usadas para chamadas externas com segredo; erros de rede são tratados com retry/fila.

### SUP-07 - Gerenciar sessão com Context API e SecureStore

**Aula:** S7, pp. 41-53. Context API para autenticação: Provider guarda session e funções, hook `useAuth()` em qualquer tela, rotas redirecionam por session, eventos de sessão atualizam o estado. Evita prop drilling.

AuthContext (tipo, provider, valor com signIn/signOut).

Proteger rotas (expo-router):

```tsx
function Rotas() {
  const { session } = useAuth();
  return (
    <Stack>
      <Stack.Protected guard={!!session}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>
      <Stack.Protected guard={!session}>
        <Stack.Screen name="login" />
      </Stack.Protected>
    </Stack>
  );
}
```

expo-secure-store: Keychain no iOS, Keystore no Android. Para tokens, chaves e segredos pequenos. Limite: valores ~2 KB (a sessão do Supabase passa disso). Atenção: no iOS o Keychain pode sobreviver à desinstalação — limpar no primeiro uso. Não existe na web. `requireAuthentication` exige biometria.

API do SecureStore:

```ts
await SecureStore.setItemAsync("token", valor);
const v = await SecureStore.getItemAsync("token");
await SecureStore.deleteItemAsync("token");
```

LargeSecureStore: solução recomendada pela documentação do Supabase para React Native. Chave AES-256 aleatória guardada no SecureStore; sessão cifrada guardada no AsyncStorage.

Checklist de segurança:
- RLS: habilitada em todas as tabelas, testada
- Chaves: service_role e S3 nunca no app
- Sessão: cifrada com SecureStore + AsyncStorage
- Contas: confirmação de e-mail, senha forte, MFA
- Storage: buckets privados, pasta por usuário
- Monitorar: logs e Security Advisor do painel

Arquitetura completa: App Expo (expo-location, mapas, Context) → Sessão (SecureStore + AsyncStorage) → Supabase (Auth, REST, Storage, RLS) → Postgres (PostGIS, tracks, points). "Do GPS do aparelho ao banco, com privacidade em cada camada."

**Complemento de implementação:** no iOS o Keychain pode sobreviver à desinstalação; limpar sessão no primeiro uso ou oferecer logout explícito. `requireAuthentication` pode adicionar atrito; usar somente quando necessário.

**Aplicação ao Enlace:** o Enlace já implementa `AuthContext`, `SessionStorageSecureStore` e rotas protegidas. Manter e validar cada camada.

**Verificar:** `expo-secure-store` é usado para tokens (não AsyncStorage puro); `LargeSecureStore` ou equivalente cifra sessões grandes; rotas protegidas redirecionam corretamente; logout limpa sessão local.

## 4. Critérios de avaliação da aula aplicados à auditoria

S7, pp. 52-53, organiza o checklist de segurança e a arquitetura completa. No Enlace, procurar evidências correspondentes:

- Arquitetura: app não fala direto com o banco; chama passa por API e RLS.
- Credenciais: `service_role` e chaves S3 nunca no cliente; `anon` segura apenas com RLS.
- Cliente: usa `LargeSecureStore` ou equivalente; `detectSessionInUrl` desabilitado.
- Autenticação: cadastro/login/logout, `getSession` vs `getUser`, `onAuthStateChange`, renovação automática.
- RLS: habilitada em todas as tabelas, políticas restritas, USING/WITH CHECK corretos, testado com usuários distintos.
- Storage: buckets privados quando adequado, políticas específicas, URLs assinadas para privado, referência estável separada da URL.
- WebServices: Edge Function como proxy para chaves externas, RPC para funções banco, Realtime quando adequado, tratamento de erros de rede.
- Sessão: Context API, SecureStore, rotas protegidas, logout limpo.

O projeto de backend Supabase apresentado na aula é uma atividade de referência, não a especificação funcional do Enlace. O [checklist](06-checklist-de-revisao.md) traduz estes critérios em verificações sem presumir o resultado.
