import React from 'react';
import { render, fireEvent } from '@testing-library/react-native';
import { EnlaceHeader } from '../../adapters/components/EnlaceHeader';

describe('EnlaceHeader (Component Test)', () => {
  it('deve renderizar o cabeçalho padrão com marca e localização', async () => {
    const { getByText } = await render(<EnlaceHeader />);

    expect(getByText('Enlace')).toBeTruthy();
    expect(getByText('Varginha, MG')).toBeTruthy();
  });

  it('deve renderizar rótulo de cidade personalizado', async () => {
    const { getByText } = await render(<EnlaceHeader cityLabel="Lavras, MG" />);

    expect(getByText('Lavras, MG')).toBeTruthy();
  });

  it('deve exibir o título da tela quando fornecido no lugar da cidade', async () => {
    const { getByText, queryByText } = await render(<EnlaceHeader title="Meus Anúncios" />);

    expect(getByText('Meus Anúncios')).toBeTruthy();
    expect(queryByText('Varginha, MG')).toBeNull();
  });

  it('deve renderizar a versão hero com largeLogo', async () => {
    const { getByText, queryByText } = await render(<EnlaceHeader largeLogo />);

    expect(getByText('Enlace')).toBeTruthy();
    expect(queryByText('Varginha, MG')).toBeNull();
  });

  it('deve exibir botão de voltar e acionar callback onBack ao pressionar', async () => {
    const mockBack = jest.fn();
    const { getByLabelText } = await render(<EnlaceHeader showBack onBack={mockBack} />);

    const backButton = getByLabelText('Voltar');
    expect(backButton).toBeTruthy();

    await fireEvent.press(backButton);
    expect(mockBack).toHaveBeenCalledTimes(1);
  });
});
