import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ConflictReviewScreen } from '../../src/adapters/screens/ConflictReviewScreen';
import { useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { ResolveSyncConflictUseCase } from '../../src/application/use-cases/ResolveSyncConflictUseCase';

export default function ConflitosRoute() {
  const router = useRouter();
  const { animalRepository, syncQueueRepository, remoteAnimalSource } = useRepositories();

  const useCase = useMemo(
    () =>
      remoteAnimalSource
        ? new ResolveSyncConflictUseCase(animalRepository, remoteAnimalSource, syncQueueRepository)
        : null,
    [animalRepository, remoteAnimalSource, syncQueueRepository]
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom', 'left', 'right']}>
      {useCase ? (
        <ConflictReviewScreen useCase={useCase} onBack={() => router.back()} />
      ) : (
        <View style={styles.center} testID="conflicts-unavailable">
          <Text>Conflitos só existem com o servidor configurado.</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#f5f5f7' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
});
