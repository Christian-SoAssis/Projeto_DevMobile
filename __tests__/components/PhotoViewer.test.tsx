import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { Dimensions } from 'react-native';
import {
  clampPan,
  clampZoom,
  PhotoViewer,
  ZOOM_MAX_SCALE,
  ZOOM_MIN_SCALE,
} from '../../src/adapters/components/PhotoViewer';
import { makePhoto } from '../../test-support/fixtures';

/** Mesma página que o componente adota (largura da janela do jest-expo). */
const VIEWER_WIDTH = Dimensions.get('window').width;

/**
 * RF09 + decisão 16: visualizador em TELA CHEIA com zoom por pinça
 * (1x–4x — gestos nativos via react-native-gesture-handler), deslizar entre
 * as fotos e fechar (✕/voltar). O zoom nativo do ScrollView é iOS-only e a
 * pinça JS perde a disputa contra o scroll nativo no Android, então os
 * cálculos ficam em helpers puros, testáveis aqui, e os gestos nativos
 * (dentro do GestureDetector) seguem para QA manual em device.
 */

const PAGE = { width: 400, height: 600 };

function counterOf(element: { props: Record<string, unknown> }): string {
  return ((element.props.children as unknown[] | undefined) ?? []).join('');
}

describe('helpers de zoom (pinça 1x–4x)', () => {
  it('clampZoom limita a faixa e sanear valores inválidos', async () => {
    expect(ZOOM_MIN_SCALE).toBe(1);
    expect(ZOOM_MAX_SCALE).toBe(4);
    expect(clampZoom(1)).toBe(1);
    expect(clampZoom(2.5)).toBeCloseTo(2.5);
    expect(clampZoom(55)).toBe(4);
    expect(clampZoom(0)).toBe(1);
    expect(clampZoom(NaN)).toBe(1);
  });

  it('clampPan contém o arrasto dentro da foto ampliada', async () => {
    // Em 1x não sobra margem: tudo volta para o mesmo lugar.
    expect(clampPan({ x: 50, y: -50 }, 1, PAGE)).toEqual({ x: 0, y: 0 });
    // 3x: a imagem sai 2x a página para cada lado; metade é o máximo.
    expect(clampPan({ x: 10000, y: -10000 }, 3, PAGE)).toEqual({ x: 400 / 2 * 2, y: -(600 / 2 * 2) });
  });
});

describe('PhotoViewer — visualizador de fotos em tela cheia (decisão 16)', () => {
  const pages = (['a', 'b', 'c'] as const).map((n) => ({
    photo: makePhoto({ localPath: `file:///p/${n}.jpg` }),
  }));

  it('abre na foto pedida (initialIndex), com todas as fotos presentes', async () => {
    const { getByTestId } = await render(<PhotoViewer visible pages={pages} initialIndex={2} onClose={jest.fn()} />);

    expect(getByTestId('photo-viewer-photo-0')).toBeTruthy();
    expect(getByTestId('photo-viewer-photo-1')).toBeTruthy();
    expect(getByTestId('photo-viewer-photo-2')).toBeTruthy();
    expect(counterOf(getByTestId('photo-viewer-position'))).toBe('3/3');
  });

  it('✕ fecha (onClose) e o ✕ continua disponível após render', async () => {
    const onClose = jest.fn();
    const { getByTestId } = await render(<PhotoViewer visible pages={pages} onClose={onClose} />);

    await fireEvent.press(getByTestId('photo-viewer-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
    // A posição inicial (foto que abriu o visualizador) refletida no contador.
    expect(counterOf(getByTestId('photo-viewer-position'))).toBe('1/3');
  });

  it('1 foto = sem contador (n/total) — página única sem troca de fotos', async () => {
    const { queryByTestId } = await render(
      <PhotoViewer visible pages={[pages[0]]} onClose={jest.fn()} />
    );

    expect(queryByTestId('photo-viewer-scroll')).toBeTruthy();
    expect(queryByTestId('photo-viewer-position')).toBeNull();
  });

  it('letterbox (decisão do usuário): foto inteira com contain e paginação nasce ligada', async () => {
    const { getByTestId } = await render(
      <PhotoViewer visible pages={pages} onClose={jest.fn()} />
    );

    // A foto do visualizador é desenhada INTEIRA (contain) sobre o fundo
    // preto — foto em outra proporção ganha barras pretas, sem corte.
    expect(getByTestId('photo-viewer-photo-0').props.resizeMode).toBe('contain');
    // Em 1x a paginação entre fotos está ligada (o zoom desliga quando amplia).
    expect(getByTestId('photo-viewer-scroll').props.scrollEnabled).toBe(true);
  });

  it('fechado (visible=false) não renderiza o conteúdo do visualizador', async () => {
    const { queryByTestId } = await render(<PhotoViewer visible={false} pages={pages} onClose={jest.fn()} />);

    expect(queryByTestId('photo-viewer-photo-0')).toBeNull();
  });
});
