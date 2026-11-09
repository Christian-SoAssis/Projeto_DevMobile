import { InterestStatus, INTEREST_TRAIL } from '../../src/domain/value-objects/InterestStatus';

describe('InterestStatus — trilha de adoção (decisão 18)', () => {
  it('a trilha tem 4 etapas na ordem definida e RECUSADA fora dela', () => {
    expect(INTEREST_TRAIL).toEqual(['ENVIADA', 'EM_ANALISE', 'VISITA_COMBINADA', 'CONCLUIDA']);
  });

  it('mapeia PENDING (legado da coluna) e nulos para ENVIADA', () => {
    expect(InterestStatus.from('PENDING').value).toBe('ENVIADA');
    expect(InterestStatus.from(null).value).toBe('ENVIADA');
    expect(InterestStatus.from(undefined).value).toBe('ENVIADA');
    expect(InterestStatus.from('estado-desconhecido').value).toBe('ENVIADA');
  });

  it('aceita todos os valores canônicos', () => {
    expect(InterestStatus.from('ENVIADA').value).toBe('ENVIADA');
    expect(InterestStatus.from('EM_ANALISE').value).toBe('EM_ANALISE');
    expect(InterestStatus.from('VISITA_COMBINADA').value).toBe('VISITA_COMBINADA');
    expect(InterestStatus.from('CONCLUIDA').value).toBe('CONCLUIDA');
    expect(InterestStatus.from('RECUSADA').value).toBe('RECUSADA');
  });

  it('stepIndex: 0..3 na trilha; RECUSADA fica fora (-1)', () => {
    expect(InterestStatus.enviada().stepIndex()).toBe(0);
    expect(InterestStatus.emAnalise().stepIndex()).toBe(1);
    expect(InterestStatus.visitaCombinada().stepIndex()).toBe(2);
    expect(InterestStatus.concluida().stepIndex()).toBe(3);
    expect(InterestStatus.recusada().stepIndex()).toBe(-1);
  });

  it('nextInTrail: avança até CONCLUIDA e para; RECUSADA não avança', () => {
    expect(InterestStatus.enviada().nextInTrail()?.value).toBe('EM_ANALISE');
    expect(InterestStatus.emAnalise().nextInTrail()?.value).toBe('VISITA_COMBINADA');
    expect(InterestStatus.visitaCombinada().nextInTrail()?.value).toBe('CONCLUIDA');
    expect(InterestStatus.concluida().nextInTrail()).toBeNull();
    expect(InterestStatus.recusada().nextInTrail()).toBeNull();
  });

  it('equals e flags de folha', () => {
    expect(InterestStatus.emAnalise().equals(InterestStatus.from('EM_ANALISE'))).toBe(true);
    expect(InterestStatus.recusada().isRecusada()).toBe(true);
    expect(InterestStatus.concluida().isConcluida()).toBe(true);
    expect(InterestStatus.enviada().isRecusada()).toBe(false);
  });
});
