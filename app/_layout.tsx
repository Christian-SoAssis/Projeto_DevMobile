import React from 'react';
import { Stack } from 'expo-router';
import { usePathname, useRootNavigationState } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { StatusBar } from 'expo-status-bar';
import { RepositoriesProvider } from '../src/adapters/context/RepositoriesContext';
import { AuthProviderBridge } from '../src/adapters/context/AuthContext';
import { AutoSync } from '../src/adapters/sync/AutoSync';
import { SessionStorageSecureStore } from '../src/adapters/auth/SessionStorageSecureStore';

/**
 * Sessão segura real do app (Keychain/Keystore via expo-secure-store).
 * O adapter degrada para memória em ambientes sem ponte nativa,
 * mantendo os testes e o modo demo estáveis.
 */
const AppSessionStorage = new SessionStorageSecureStore();

/**
 * DIAGNÓSTICO TEMPORÁRIO (apaga após validar o bug "voltar cai no Início"):
 * registra no terminal cada mudança de rota com a pilha na raiz do stack.
 * Só em desenvolvimento (__DEV__) — zero efeito em build de produção.
 */
function NavigationLogger() {
  const pathname = usePathname();
  const rootState = useRootNavigationState();
  React.useEffect(() => {
    if (__DEV__) {
      const stack = (rootState?.routes ?? []).map((route) => route.name + (route.state ? `(${route.state.index ?? 0})` : ''));
      console.log('[NAV]', pathname, '→', JSON.stringify(stack));
    }
  }, [pathname, rootState]);
  return null;
}

export default function RootLayout() {
  return (
    // Requisito do react-native-gesture-handler (decisão 16 — pinça do
    // visualizador de fotos): a raiz do app precisa de um root de gestos
    // para os GestureDetectors negociarem no nativo.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
      {/* Fase 2: persistência local real (SQLite) + Fase 3: Supabase opcional.
          A ordem dos providers é: container primeiro, auth depois — o
          AuthProviderBridge entrega o SupabaseAuthGateway do container
          quando configurado, ou mantém o fake de demonstração (§0.1). */}
      <RepositoriesProvider>
        <AuthProviderBridge sessionStorage={AppSessionStorage}>
          <StatusBar style="dark" />
          <AutoSync />
          <NavigationLogger />
          {/* OUTER STACK (padrão canônico da doc, seção "Going back to the
              tab you came from"): telas FORA das abas (detalhes, formulários)
              populam ESTE stack distintamente, e o pop volta mantendo o estado
              interno do navegador de abas. O <Slot /> anterior montava o grupo
              de abas NOVAMENTE no pop — tab em estado inicial (1ª aba, Início),
              que era o bug relatado (voltar → Início). Rotas fora de abas
              continuam irmãs aqui (login, cadastro, animal/[id], protected). */}
          <Stack screenOptions={{ headerShown: false }} />
        </AuthProviderBridge>
      </RepositoriesProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
