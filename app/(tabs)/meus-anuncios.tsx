import React from 'react';
import { StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MyAnimalsScreen } from '../../src/adapters/screens/MyAnimalsScreen';
import { LoginRequired } from '../../src/adapters/components/LoginRequired';
import { useAuth } from '../../src/adapters/context/AuthContext';
import { useFocusKey } from '../../src/adapters/hooks/useFocusKey';
import { animalRepository, syncQueueRepository } from '../../src/adapters/demo/sharedFakes';

export default function MeusAnunciosTab() {
  const router = useRouter();
  const { user } = useAuth();
  const focusKey = useFocusKey();

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      {user ? (
        <MyAnimalsScreen
          key={focusKey}
          animalRepository={animalRepository}
          syncQueueRepository={syncQueueRepository}
          ownerId={user.id}
          onSelectAnimal={(animal) =>
            router.push({ pathname: '/animal/[id]', params: { id: animal.id } })
          }
          onEditAnimal={(animal) =>
            router.push({ pathname: '/(protected)/editar-anuncio', params: { id: animal.id } })
          }
          onNewAnimal={() => router.push('/(protected)/novo-anuncio')}
        />
      ) : (
        <LoginRequired
          message="Entre na sua conta para publicar e gerenciar seus anúncios."
          onLogin={() => router.push('/login')}
          onRegister={() => router.push('/cadastro')}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#f5f5f7',
  },
});
