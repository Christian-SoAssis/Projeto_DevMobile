import { SupabaseAnimalRepository } from '../../../infrastructure/supabase/repositories/SupabaseAnimalRepository';
import { Animal } from '../../../domain/entities/Animal';
import { AnimalCharacteristics } from '../../../domain/value-objects/AnimalCharacteristics';
import { ApproximateLocation } from '../../../domain/value-objects/ApproximateLocation';
import { AdoptionStatus } from '../../../domain/value-objects/AdoptionStatus';
import { AnimalPhoto } from '../../../domain/entities/AnimalPhoto';

function makeSupabaseClient(rows: Record<string, any[]> = {}) {
  const tables: Record<string, any[]> = {
    animals: [],
    animal_photos: [],
    animal_tombstones: [],
    ...rows,
  };

  // Cria um objeto query onde todos os métodos retornam o próprio objeto (cadeia)
  function createQuery(tableName: string) {
    const chain: any = {};

    // Métodos de encadeamento retornam o próprio chain
    const chainMethods = ['select', 'neq', 'order', 'gte', 'gt', 'eq'];
    for (const m of chainMethods) {
      chain[m] = jest.fn().mockReturnThis();
    }

    // limit executa a consulta e retorna { data, error }
    chain.limit = jest.fn().mockImplementation((n: number) => {
      let result = [...(tables[tableName] ?? [])];
      // Aplica filtros eq
      const eqCalls = (chain.eq as jest.Mock).mock.calls;
      for (const [col, val] of eqCalls) {
        result = result.filter((r) => r[col] === val);
      }
      // Aplica gte
      const gteCalls = (chain.gte as jest.Mock).mock.calls;
      for (const [col, val] of gteCalls) {
        result = result.filter((r) => r[col] >= val);
      }
      // Aplica gt
      const gtCalls = (chain.gt as jest.Mock).mock.calls;
      for (const [col, val] of gtCalls) {
        result = result.filter((r) => r[col] > val);
      }
      // Aplica neq
      const neqCalls = (chain.neq as jest.Mock).mock.calls;
      for (const [col, val] of neqCalls) {
        result = result.filter((r) => r[col] !== val);
      }
      // Ordenação simples
      const orderCalls = (chain.order as jest.Mock).mock.calls;
      if (orderCalls.length > 0) {
        const [col, opts] = orderCalls[0];
        const asc = opts?.ascending ?? true;
        result.sort((a, b) => {
          const av = a[col];
          const bv = b[col];
          if (av < bv) return asc ? -1 : 1;
          if (av > bv) return asc ? 1 : -1;
          return 0;
        });
      }
      const limited = result.slice(0, n);
      return { data: limited, error: null };
    });

    chain.maybeSingle = jest.fn().mockImplementation(async () => {
      let result = [...(tables[tableName] ?? [])];
      const eqCalls = (chain.eq as jest.Mock).mock.calls;
      for (const [col, val] of eqCalls) {
        result = result.filter((r) => r[col] === val);
      }
      return { data: result[0] ?? null, error: null };
    });

    chain.single = jest.fn().mockImplementation(async () => {
      let result = [...(tables[tableName] ?? [])];
      const eqCalls = (chain.eq as jest.Mock).mock.calls;
      for (const [col, val] of eqCalls) {
        result = result.filter((r) => r[col] === val);
      }
      return { data: result[0] ?? null, error: null };
    });

    chain.upsert = jest.fn().mockImplementation((row: any, _opts: any) => {
      const idx = tables[tableName].findIndex((r) => r.id === row.id);
      if (idx >= 0) {
        tables[tableName][idx] = { ...tables[tableName][idx], ...row };
      } else {
        tables[tableName].push(row);
      }
      return {
        data: row,
        error: null,
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockResolvedValue({ data: row, error: null }),
      };
    });

    chain.update = jest.fn().mockImplementation((row: any) => {
      const eqFilters: [string, any][] = [];
      const updateChain: any = {
        eq: jest.fn().mockImplementation((col: string, val: any) => {
          eqFilters.push([col, val]);
          return updateChain;
        }),
        select: jest.fn().mockReturnThis(),
        single: jest.fn().mockImplementation(async () => {
          const idx = tables[tableName].findIndex((r) => {
            return eqFilters.every(([col, val]) => r[col] === val);
          });
          if (idx >= 0) {
            tables[tableName][idx] = { ...tables[tableName][idx], ...row };
            return { data: tables[tableName][idx], error: null };
          }
          return { data: null, error: { message: 'not found or version conflict' } };
        }),
      };
      return updateChain;
    });

    chain.insert = jest.fn().mockImplementation((rows: any[]) => {
      tables[tableName].push(...rows);
      return { data: rows, error: null };
    });

    chain.delete = jest.fn().mockImplementation((_) => {
      // delete().eq('col', val) retorna o chain para permitir .eq() após .delete()
      const deleteChain: any = {
        eq: jest.fn().mockImplementation((col: string, val: any) => {
          tables[tableName] = tables[tableName].filter((r) => r[col] !== val);
          return { data: null, error: null };
        }),
      };
      return deleteChain;
    });

    return chain;
  }

  return {
    from: jest.fn((table: string) => createQuery(table)),
    auth: {
      getSession: jest.fn().mockResolvedValue({
        data: { session: { user: { id: 'user-1' } } },
        error: null,
      }),
    },
    storage: {
      from: () => ({
        upload: jest.fn().mockResolvedValue({ data: null, error: null }),
        getPublicUrl: jest.fn().mockReturnValue({ data: { publicUrl: 'https://public.url' } }),
      }),
    },
  } as any;
}

describe('SupabaseAnimalRepository (DAT-05, OFF-06)', () => {
  it('deve listar animais visíveis com cursor de paginação', async () => {
    const client = makeSupabaseClient({
      animals: [
        {
          id: 'a1', owner_id: 'u1', name: 'Amora', species: 'Cão', size: 'Médio',
          approximate_age: '2 anos', sex: 'Fêmea', status: 'AVAILABLE',
          neighborhood: 'Centro', city: 'Varginha', region: 'MG',
          latitude: -21.55, longitude: -45.43, moderation_status: 'NONE',
          version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
          animal_photos: [],
        },
        {
          id: 'a2', owner_id: 'u1', name: 'Bob', species: 'Gato', size: 'Pequeno',
          approximate_age: '1 ano', sex: 'Macho', status: 'AVAILABLE',
          neighborhood: 'Centro', city: 'Varginha', region: 'MG',
          latitude: -21.55, longitude: -45.43, moderation_status: 'NONE',
          version: 1, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
          animal_photos: [],
        },
      ],
    });
    const repo = new SupabaseAnimalRepository(client);

    const page = await repo.listVisibleChangedAfter(null, 10);

    expect(page.animals.length).toBe(2);
    expect(page.nextCursor).not.toBeNull();
    expect(page.animals[0].name).toBe('Amora');
    expect(page.animals[1].name).toBe('Bob');
  });

  it('deve filtrar animais ocultos (moderation_status HIDDEN)', async () => {
    const client = makeSupabaseClient({
      animals: [
        {
          id: 'a1', owner_id: 'u1', name: 'Amora', species: 'Cão', size: 'Médio',
          approximate_age: '2 anos', sex: 'Fêmea', status: 'AVAILABLE',
          neighborhood: 'Centro', city: 'Varginha', region: 'MG',
          latitude: -21.55, longitude: -45.43, moderation_status: 'HIDDEN',
          version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
          animal_photos: [],
        },
        {
          id: 'a2', owner_id: 'u1', name: 'Bob', species: 'Gato', size: 'Pequeno',
          approximate_age: '1 ano', sex: 'Macho', status: 'AVAILABLE',
          neighborhood: 'Centro', city: 'Varginha', region: 'MG',
          latitude: -21.55, longitude: -45.43, moderation_status: 'NONE',
          version: 1, created_at: '2026-01-02T00:00:00Z', updated_at: '2026-01-02T00:00:00Z',
          animal_photos: [],
        },
      ],
    });
    const repo = new SupabaseAnimalRepository(client);

    const page = await repo.listVisibleChangedAfter(null, 10);

    expect(page.animals.length).toBe(1);
    expect(page.animals[0].name).toBe('Bob');
  });

  it('deve buscar animal por ID', async () => {
    const client = makeSupabaseClient({
      animals: [
        {
          id: 'a1', owner_id: 'u1', name: 'Amora', species: 'Cão', size: 'Médio',
          approximate_age: '2 anos', sex: 'Fêmea', status: 'AVAILABLE',
          neighborhood: 'Centro', city: 'Varginha', region: 'MG',
          latitude: -21.55, longitude: -45.43, moderation_status: 'NONE',
          version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
          animal_photos: [],
        },
      ],
    });
    const repo = new SupabaseAnimalRepository(client);

    const animal = await repo.findById('a1');

    expect(animal).not.toBeNull();
    expect(animal?.id).toBe('a1');
    expect(animal?.name).toBe('Amora');
  });

  it('deve retornar null para animal inexistente', async () => {
    const client = makeSupabaseClient({ animals: [] });
    const repo = new SupabaseAnimalRepository(client);

    const animal = await repo.findById('inexistente');
    expect(animal).toBeNull();
  });

  it('deve criar animal remoto com controle de versão', async () => {
    const client = makeSupabaseClient({ animals: [] });
    const repo = new SupabaseAnimalRepository(client);

    const animal = new Animal({
      id: 'new-1', ownerId: 'u1', name: 'Novo',
      characteristics: new AnimalCharacteristics({
        species: 'Cão', size: 'Médio', approximateAge: '1 ano', sex: 'Fêmea',
      }),
      location: new ApproximateLocation({ neighborhood: 'Centro', city: 'Varginha' }),
      status: AdoptionStatus.available(),
      photos: [],
      version: 1,
    });

    const created = await repo.createRemote(animal);

    expect(created.id).toBe('new-1');
    expect(created.name).toBe('Novo');
  });

  it('deve atualizar animal remoto com bloqueio otimista de versão', async () => {
    const client = makeSupabaseClient({
      animals: [
        {
          id: 'a1', owner_id: 'u1', name: 'Amora', species: 'Cão', size: 'Médio',
          approximate_age: '2 anos', sex: 'Fêmea', status: 'AVAILABLE',
          neighborhood: 'Centro', city: 'Varginha', region: 'MG',
          latitude: -21.55, longitude: -45.43, moderation_status: 'NONE',
          version: 1, created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
          animal_photos: [],
        },
      ],
    });
    const repo = new SupabaseAnimalRepository(client);

    const animal = new Animal({
      id: 'a1', ownerId: 'u1', name: 'Amora Atualizada',
      characteristics: new AnimalCharacteristics({
        species: 'Cão', size: 'Médio', approximateAge: '2 anos', sex: 'Fêmea',
      }),
      location: new ApproximateLocation({ neighborhood: 'Centro', city: 'Varginha' }),
      status: AdoptionStatus.available(),
      photos: [],
      version: 1,
    });

    const updated = await repo.updateRemote(animal, 1);
    expect(updated.name).toBe('Amora Atualizada');
  });

  it('deve lançar erro de conflito quando versão remota diverge', async () => {
    const client = makeSupabaseClient({
      animals: [
        {
          id: 'a1', owner_id: 'u1', name: 'Amora', species: 'Cão', size: 'Médio',
          approximate_age: '2 anos', sex: 'Fêmea', status: 'AVAILABLE',
          neighborhood: 'Centro', city: 'Varginha', region: 'MG',
          latitude: -21.55, longitude: -45.43, moderation_status: 'NONE',
          version: 5,
          created_at: '2026-01-01T00:00:00Z', updated_at: '2026-01-01T00:00:00Z',
          animal_photos: [],
        },
      ],
    });
    const repo = new SupabaseAnimalRepository(client);

    const animal = new Animal({
      id: 'a1', ownerId: 'u1', name: 'Amora Antiga',
      characteristics: new AnimalCharacteristics({
        species: 'Cão', size: 'Médio', approximateAge: '2 anos', sex: 'Fêmea',
      }),
      location: new ApproximateLocation({ neighborhood: 'Centro', city: 'Varginha' }),
      status: AdoptionStatus.available(),
      photos: [],
      version: 1,
    });

    await expect(repo.updateRemote(animal, 1)).rejects.toThrow(/CONFLICT_VERSION/);
  });

  it('deve listar tombstones após cursor', async () => {
    const client = makeSupabaseClient({
      animal_tombstones: [
        { animal_id: 'a1', reason: 'DELETED', removed_at: '2026-01-01T00:00:00Z' },
      ],
    });
    const repo = new SupabaseAnimalRepository(client);

    const page = await repo.listTombstonesAfter(null, 10);

    expect(page.tombstones.length).toBe(1);
    expect(page.tombstones[0].animalId).toBe('a1');
    expect(page.tombstones[0].reason).toBe('DELETED');
  });
});
