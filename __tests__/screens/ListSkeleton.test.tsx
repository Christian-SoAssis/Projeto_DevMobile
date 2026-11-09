import React from 'react';
import { render } from '@testing-library/react-native';
import { ListSkeleton } from '../../src/adapters/components/ListSkeleton';

describe('ListSkeleton Component (melhoria #9)', () => {
  it('renderiza o número pedido de linhas com IDs navegáveis', async () => {
    const { getByTestId, queryByTestId } = await render(<ListSkeleton rows={3} />);

    expect(getByTestId('list-skeleton')).toBeTruthy();
    expect(getByTestId('list-skeleton-row-1')).toBeTruthy();
    expect(getByTestId('list-skeleton-row-2')).toBeTruthy();
    expect(getByTestId('list-skeleton-row-3')).toBeTruthy();
    expect(queryByTestId('list-skeleton-row-4')).toBeNull();
  });

  it('usa o testID projetado (favoritos/my-animals) para telas específicas', async () => {
    const { getByTestId } = await render(<ListSkeleton rows={1} testID="favorites-skeleton" />);
    expect(getByTestId('favorites-skeleton-row-1')).toBeTruthy();
  });
});
