import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ModerationScreen } from '../../src/adapters/screens/ModerationScreen';
import { RequireAccess } from '../../src/adapters/guards/RequireAccess';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { ModerateAnimalUseCase } from '../../src/application/use-cases/ModerateAnimalUseCase';

export default function ModeracaoTab() {
  const router = useRouter();
  const { moderationGateway } = useRepositories();
  const useCase = useMemo(
    () => (moderationGateway ? new ModerateAnimalUseCase(moderationGateway) : null),
    [moderationGateway]
  );

  return (
    <RequireAccess area="MODERATION">
      {(user) => (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
          {useCase ? (
            <ModerationScreen
              actor={user}
              useCase={useCase}
              onSelectAnimal={(entry) =>
                router.push({ pathname: '/animal/[id]', params: { id: entry.animal.id } })
              }
            />
          ) : (
            <View style={styles.center} testID="moderation-unavailable">
              <Text>A moderação só funciona com o servidor configurado.</Text>
            </View>
          )}
        </SafeAreaView>
      )}
    </RequireAccess>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
