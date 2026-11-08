import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Dimensions, Text } from 'react-native';
import { PhotoCarousel, PhotoPage } from '../../src/adapters/components/PhotoCarousel';
import { makePhoto } from '../../test-support/fixtures';

/** Mesma página que o componente adota (largura da janela do jest-expo). */
const PAGE_WIDTH = Dimensions.get('window').width;

/**
 * RF09 + decisão 16: carrossel das fotos do anúncio — ≥ 2 fotos ficam
 * navegáveis (indicador "n/total" + pontos), 1 foto = foto simples
 * (sem indicador); as páginas reutilizam a resolução do AnimalPhotoView,
 * podem abrir o visualizador com zoom (onPress) e aceitam controles por
 * foto (footer do formulário).
 */

function counterOf(element: { props: Record<string, unknown> }): string {
  return ((element.props.children as unknown[] | undefined) ?? []).join('');
}

function threePages(): PhotoPage[] {
  return (['a', 'b', 'c'] as const).map((n) => ({
    photo: makePhoto({ localPath: `file:///p/${n}.jpg` }),
    testID: `photo-${n}`,
  }));
}

describe('PhotoCarousel — carrossel das fotos do anúncio (decisão 16)', () => {
  it('≥ 2 fotos: todas as páginas renderizam com o indicador posicional', async () => {
    const { getByTestId } = await render(<PhotoCarousel pages={threePages()} testID="carousel" />);

    expect(getByTestId('photo-a')).toBeTruthy();
    expect(getByTestId('photo-b')).toBeTruthy();
    expect(getByTestId('photo-c')).toBeTruthy();
    expect(getByTestId('carousel-indicator')).toBeTruthy();
    expect(counterOf(getByTestId('carousel-position'))).toBe('1/3');
    expect(getByTestId('carousel-dot-0')).toBeTruthy();
    expect(getByTestId('carousel-dot-2')).toBeTruthy();
  });

  it('ponto de posição leva à foto pedida e avisa a tela hospedeira', async () => {
    const onPageChange = jest.fn();
    const { getByTestId } = await render(
      <PhotoCarousel pages={threePages()} testID="carousel" onPageChange={onPageChange} />
    );

    await fireEvent.press(getByTestId('carousel-dot-2'));

    expect(counterOf(getByTestId('carousel-position'))).toBe('3/3');
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('1 foto = foto simples: sem indicador e toque pressionável', async () => {
    const onPress = jest.fn();
    const { getByTestId, queryByTestId } = await render(
      <PhotoCarousel
        pages={[{ photo: makePhoto({ localPath: 'file:///p/a.jpg' }), testID: 'photo-a', onPress }]}
        testID="carousel"
      />
    );

    expect(queryByTestId('carousel-indicator')).toBeNull();
    expect(queryByTestId('carousel-position')).toBeNull();
    await fireEvent.press(getByTestId('photo-a-tap'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('páginas aceitam controles por foto (footer do formulário)', async () => {
    const onMove = jest.fn();
    const pages = threePages().map((page, index) =>
      index === 0
        ? {
            ...page,
            footer: (
              <Text onPress={onMove} testID="control-0">
                ◀
              </Text>
            ),
          }
        : page
    );
    const { getByTestId } = await render(<PhotoCarousel pages={pages} testID="carousel" />);

    await fireEvent.press(getByTestId('control-0'));
    expect(onMove).toHaveBeenCalledTimes(1);
  });

  it('lista encolhendo (remoção no formulário): indicador recua para a última página válida', async () => {
    const { getByTestId, queryByTestId, rerender } = await render(
      <PhotoCarousel pages={threePages()} testID="carousel" />
    );
    const carousel = queryByTestId('carousel');
    expect(carousel).toBeTruthy();
    if (!carousel) throw new Error('carrossel ausente');

    // Navega para a 3ª página antes de encolher a lista.
    await fireEvent.press(getByTestId('carousel-dot-2'));
    expect(counterOf(getByTestId('carousel-position'))).toBe('3/3');

    await rerender(<PhotoCarousel pages={threePages().slice(0, 2)} testID="carousel" />);
    expect(counterOf(getByTestId('carousel-position'))).toBe('2/2');
  });
});
