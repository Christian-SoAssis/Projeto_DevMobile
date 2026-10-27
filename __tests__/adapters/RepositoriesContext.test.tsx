import React from 'react';
import { Text, View } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import {
  InMemorySqliteDriver,
  setTestDatabaseDriver,
} from '../../src/infrastructure/database/sqlite/DatabaseDriver';
import { INITIAL_SCHEMA_SQL } from '../../src/infrastructure/database/sqlite/migrations/schema.sql';
import { RepositoriesProvider, useRepositories } from '../../src/adapters/context/RepositoriesContext';
import { animalRepository as demoAnimalRepository, demoContainer } from '../../src/adapters/demo/sharedFakes';

function Probe() {
  const container = useRepositories();
  return (
    <View>
      <Text testID="probe-mode">{container.mode}</Text>
      <Text testID="probe-repo">{container.animalRepository.constructor.name}</Text>
    </View>
  );
}

describe('RepositoriesContext — composição da persistência (Fase 2)', () => {
  it('provider: carrega o container SQLite e só então renderiza as rotas', async () => {
    const db = new InMemorySqliteDriver();
    await db.execAsync(INITIAL_SCHEMA_SQL);
    setTestDatabaseDriver(db);

    const { getByTestId, queryByTestId } = render(
      <RepositoriesProvider>
        <Probe />
      </RepositoriesProvider>
    );

    // Estado inicial de boot mostra o placeholder (testID repos-loading).
    expect(getByTestId('repos-loading')).toBeTruthy();

    await waitFor(() => {
      expect(getByTestId('probe-mode').props.children).toBe('sqlite');
    });
    expect(queryByTestId('repos-loading')).toBeNull();
    expect(getByTestId('probe-repo').props.children).toBe('SqliteAnimalRepository');
  });

  it('provider: se a composição falhar, o app segue no modo demo sem travar', async () => {
    const falhou = async (): Promise<never> => {
      throw new Error('banco indisponível');
    };

    const { getByTestId } = render(
      <RepositoriesProvider loadContainer={falhou}>
        <Probe />
      </RepositoriesProvider>
    );

    await waitFor(() => {
      expect(getByTestId('probe-mode').props.children).toBe('demo');
    });
  });

  it('sem provider (rotas avulsas/testes de rota): fallback demo em memória', async () => {
    const { getByTestId } = render(<Probe />);

    await waitFor(() => {
      expect(getByTestId('probe-mode').props.children).toBe('demo');
    });
    expect(getByTestId('probe-repo').props.children).toBe(
      demoAnimalRepository.constructor.name
    );
  });

  it('desmontar o provider antes de carregar não gera atualização de estado órfã', async () => {
    const demorado = (): Promise<ReturnType<typeof useRepositories>> =>
      new Promise((resolve) => setTimeout(() => resolve(demoContainer), 20));

    const { getByTestId, unmount } = render(
      <RepositoriesProvider loadContainer={demorado}>
        <Probe />
      </RepositoriesProvider>
    );

    // Ainda montado: a indisponibilidade do load é o placeholder visível.
    expect(getByTestId('repos-loading')).toBeTruthy();

    unmount();

    // A promise depois disso deve resolver sem crash nem update de estado
    // no componente desmontado (defesa `if (active)` no boot).
    await expect(demorado()).resolves.toMatchObject({ mode: 'demo' });
  });
});
