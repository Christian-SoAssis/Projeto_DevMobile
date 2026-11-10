import React, { useCallback, useRef, useState } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MyAnimalsScreen } from '../../src/adapters/screens/MyAnimalsScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { useConnectivity } from '../../src/adapters/hooks/useConnectivity';
import { useFullSync } from '../../src/adapters/hooks/useFullSync';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';

export default function MeusAnunciosTab() {
  const router = useRouter();
  const isOnline = useConnectivity();
  const runSync = useFullSync();
  // Fase 2: repositórios SQLite compostos pelo RepositoriesProvider.
  const { animalRepository, syncQueueRepository, unitOfWork, remoteMode } = useRepositories();

  // Pulso de atualização: com o outer Stack (fix "voltar mantém a aba"), o
  // pop do formulário/detalhes NÃO remonta esta aba — relê o banco a cada
  // foco para o animal recém-criado/editado aparecer de imediato.
  const [refreshToken, setRefreshToken] = useState(0);
  const SKIP = useRef(true); // 1º foco = montagem inicial: a tela já carrega
  useFocusEffect(
    useCallback(() => {
      if (SKIP.current) {
        SKIP.current = false;
        return;
      }
      setRefreshToken((token) => token + 1);
    }, [])
  );

  return (
    <RequireAccess area="MY_ANIMALS">
      {(user) => (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          <MyAnimalsScreen
            animalRepository={animalRepository}
            syncQueueRepository={syncQueueRepository}
            unitOfWork={unitOfWork}
            ownerId={user.id}
            isOnline={isOnline}
            onSync={remoteMode === 'supabase' ? runSync : undefined}
            refreshToken={refreshToken}
            onSelectAnimal={(animal) =>
              router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
            }
            onEditAnimal={(animal) =>
              router.push({ pathname: '/(protected)/editar-anuncio', params: { id: animal.id } })
            }
            onNewAnimal={() => router.push('/(protected)/novo-anuncio')}
          />
        </SafeAreaView>
      )}
    </RequireAccess>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
});
