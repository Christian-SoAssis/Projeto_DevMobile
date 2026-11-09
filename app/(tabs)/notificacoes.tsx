import { useFocusRefresh } from '../../src/adapters/hooks/useFocusRefresh';
import React, { useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NotificationsScreen } from '../../src/adapters/screens/NotificationsScreen';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { BuildNotificationsUseCase, NotificationItem } from '../../src/application/use-cases/BuildNotificationsUseCase';

export default function NotificacoesTab() {
  const router = useRouter();
  const refreshToken = useFocusRefresh();
  const { user } = useAuth();
  const {
    appStateRepository,
    animalRepository,
    interestRepository,
    remoteInterests,
    syncQueueRepository,
  } = useRepositories();

  // Feed derivado (decisão 20): sem tabela de notificações — os dados já
  // existentes alimentam a central. `useMemo` evita recriar o use case (o
  // effect da tela depende dele para não recarregar a cada render).
  const notifications = useMemo(
    () =>
      new BuildNotificationsUseCase(appStateRepository, {
        animalRepository,
        localInterests: interestRepository,
        remoteInterests,
        syncQueueRepository,
      }),
    [appStateRepository, animalRepository, interestRepository, remoteInterests, syncQueueRepository]
  );

  // Manter simples: anúncio alvo (interesse/trilha) → detalhes; item da fila → Conta (revision areas).
  const openItem = (item: NotificationItem) => {
    if (item.animalId) {
      router.push({ pathname: '/animal/[id]', params: { id: item.animalId } });
      return;
    }
    router.push('/(tabs)/sync');
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <NotificationsScreen refreshToken={refreshToken} userId={user?.id ?? null} useCase={notifications} onOpenItem={openItem} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f7' },
});
