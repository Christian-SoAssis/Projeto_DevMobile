import { Animal } from '../../src/domain/entities/Animal';
import { AnimalCharacteristics } from '../../src/domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../src/domain/value-objects/ApproximateLocation';
import { SyncAction, PERMANENT_SYNC_FAILURE_MARKER } from '../../src/domain/entities/SyncAction';
import {
  SincronizacaoService,
  PermanentSyncError,
} from '../../src/domain/services/SincronizacaoService';
import { AnimalRepositoryFake } from '../../src/application/fakes/AnimalRepositoryFake';
import { SyncQueueRepositoryFake } from '../../src/application/fakes/SyncQueueRepositoryFake';
import { ProcessSyncQueueUseCase } from '../../src/application/use-cases/ProcessSyncQueueUseCase';
import { AnimalRepository, AnimalFilterOptions } from '../../src/domain/ports/AnimalRepository';

/**
 * OFF-05/DAT-11 (ordem 7 — backoff com espaçamento + classificação de
 * erros, cenários T09/T17): uma falha TRANSITÓRIA (rede instável) não
 * volta a tentar imediatamente no ciclo seguinte — espera o backoff
 * (2s, 4s, ... cap 30s). Uma falha PERMANENTE (ex.: anúncio apagado
 * enquanto a fila esperava) NUNCA é reenviada: tentar de novo é custo
 * certo, o resultado não muda.
 */

function makeAnimal(id: string): Animal {
  return new Animal({
    id,
    ownerId: 'usr_1',
    name: 'Luna',
    characteristics: new AnimalCharacteristics({
      species: 'Cão',
      size: 'Pequeno',
      approximateAge: '2 anos',
      sex: 'Fêmea',
    }),
    location: new ApproximateLocation({
      latitude: -21.55,
      longitude: -45.44,
      neighborhood: 'Centro',
      city: 'Varginha',
      region: 'MG',
    }),
  });
}

/** Repositório que delega a leitura, mas a perna remota cai na 1ª chamada. */
class RepoComRedeInstavel extends AnimalRepositoryFake implements AnimalRepository {
  private updateCalls = 0;

  constructor(
    base: AnimalRepositoryFake,
    /** Rede "cai" na 1ª chamada se verdadeiro (flip manual nas provas). */
    public lancar: boolean
  ) {
    super([...base.items.values()]);
  }

  get chamadasUpdate(): number {
    return this.updateCalls;
  }

  async updateRemote(animal: Animal): Promise<Animal> {
    this.updateCalls += 1;
    if (this.lancar) throw new Error('conexão instável');
    return Promise.resolve(animal);
  }
}

describe('SincronizacaoService — política de retry (OFF-05/DAT-11)', () => {
  const T0 = Date.parse('2026-01-01T00:00:00.000Z');

  function acaoFalhada(attempts: number, changedAt: string): SyncAction {
    const a = new SyncAction({
      id: 'act_1',
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: 'a1',
      payload: {},
      changedAt,
    });
    for (let i = 0; i < attempts; i++) {
      a.markFailed('conexão instável', changedAt);
    }
    return a;
  }

  it('backoff é crescente: 2s, 4s … e cap 30s (existente)', () => {
    expect(SincronizacaoService.calculateBackoffDelayMs(1)).toBe(2000);
    expect(SincronizacaoService.calculateBackoffDelayMs(2)).toBe(4000);
    expect(SincronizacaoService.calculateBackoffDelayMs(99)).toBe(30000);
  });

  it('retryIsDue: antes do backoff espera; no horário, reenvia', () => {
    const action = acaoFalhada(1, new Date(T0).toISOString());
    expect(SincronizacaoService.calculateBackoffDelayMs(1)).toBe(2000);

    expect(SincronizacaoService.retryIsDue(action, 5, T0 + 1999)).toBe(false);
    expect(SincronizacaoService.retryIsDue(action, 5, T0 + 2000)).toBe(true);
  });

  it('retryIsDue: erro PERMANENTE nunca fica due, mesmo com tempo adiantado', () => {
    const a = acaoFalhada(1, new Date(T0).toISOString());
    a.markFailedPermanently('Registro local do anúncio não encontrado.', new Date(T0).toISOString());

    expect(a.lastError).toContain(PERMANENT_SYNC_FAILURE_MARKER);
    expect(SincronizacaoService.retryIsDue(a, 5, T0 + 60_000)).toBe(false);
  });

  it('markFailed: falha TAMBÉM é um "change" — timestamp REGISTRA o momento da falha', () => {
    const a = new SyncAction({ id: 'x', operation: 'UPDATE', entityType: 'animal', entityId: 'a1', payload: {} });
    a.markFailed('rede', new Date(T0 + 500).toISOString());
    expect(a.changedAt).toBe(new Date(T0 + 500).toISOString());
  });

  it('PermanentSyncError sinaliza classificação para o worker', () => {
    expect(new PermanentSyncError('Operação de sincronização não suportada: X')).toBeInstanceOf(Error);
  });
});

describe('ProcessSyncQueueUseCase — espaçamento e classificação (OFF-05/DAT-11)', () => {
  let nowMs: number;
  const now = () => nowMs;

  beforeEach(() => {
    nowMs = Date.parse('2026-01-01T00:00:00.000Z');
  });

  function montar(repo: AnimalRepository) {
    const queue = new SyncQueueRepositoryFake();
    const worker = new ProcessSyncQueueUseCase(queue, repo, 5, undefined, {}, now);
    return { queue, worker };
  }

  function enfileirarUpdate(queue: SyncQueueRepositoryFake) {
    queue.queue.set('sync_update_a1_v2', new SyncAction({
      id: 'sync_update_a1_v2',
      operation: 'UPDATE',
      entityType: 'animal',
      entityId: 'a1',
      payload: { version: 2 },
    }));
  }

  it('falha transitória: NÃO reenvia imediatamente no ciclo seguinte (espaça 2s); após o backoff, reenvia', async () => {
    const repo = new RepoComRedeInstavel(new AnimalRepositoryFake([makeAnimal('a1')]), true);
    const { queue, worker } = montar(repo);
    enfileirarUpdate(queue);

    // Ciclo 1: rede instável → falha (attempts 1).
    await worker.execute();
    const falha = (await queue.listPending())[0];
    expect(falha.status.isFailed()).toBe(true);
    expect(falha.attempts).toBe(1);

    // Ciclo 2 imediato (+500ms < 2s): backoff — não reenvia, não conta nada.
    nowMs += 500;
    await worker.execute();
    expect(repo.chamadasUpdate).toBe(1); // só a 1ª chamada
    expect((await queue.listPending())[0].attempts).toBe(1);

    // Adianta o relógio ±3s (attempts 1 → backoff 2s; na 2ª falha 4s; ok).
    nowMs += 3000;
    repo.lancar = false; // rede volta
    await worker.execute();
    expect(repo.chamadasUpdate).toBe(2);
    const pendentes = await queue.listPending();
    expect(pendentes).toHaveLength(0); // completou e saiu da fila
  });

  it('falha PERMANENTE (anúncio apagado localmente): nunca reenvia, mesmo adiantando o relógio', async () => {
    const repo = new RepoComRedeInstavel(new AnimalRepositoryFake(), false);
    const { queue, worker } = montar(repo);
    enfileirarUpdate(queue); // a1 não existe no repositório

    const r1 = await worker.execute();
    expect(r1.failedCount).toBe(1);

    nowMs += 60_000; // muito além de qualquer backoff
    const r2 = await worker.execute();
    expect(r2.failedCount).toBe(1); // reconhecida, não re-enviada

    const item = (await queue.listPending())[0];
    expect(item.lastError).toContain(PERMANENT_SYNC_FAILURE_MARKER);
    expect(item.attempts).toBe(1);
    expect((repo as RepoComRedeInstavel).chamadasUpdate).toBe(0); // nunca chegou a enviar
  });

  it('attempts esgotados (maxAttempts): falha segue parada sem erro do worker', async () => {
    const repo = new RepoComRedeInstavel(new AnimalRepositoryFake([makeAnimal('a1')]), true);
    const { queue, worker } = montar(repo);
    enfileirarUpdate(queue);
    for (let i = 0; i < 5; i++) {
      nowMs += 31_000; // sempre acima do backoff do ciclo corrente
      await worker.execute();
    }
    const item = (await queue.listPending())[0];
    expect(item.attempts).toBe(5);
    expect(item.status.isFailed()).toBe(true);

    nowMs += 60_000;
    const r = await worker.execute();
    expect(r.failedCount).toBe(1); // permanece parada, sem reenvio
    expect(repo.chamadasUpdate).toBe(5);
  });
});
