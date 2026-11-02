import {
  SupabaseClientLike,
  SupabaseModuleLike,
  SupabaseAuthApi,
  SupabaseTable,
  SupabaseFilter,
  SupabaseInsertBuilder,
  SupabaseMutationBuilder,
  PostgrestResult,
} from '../src/infrastructure/supabase/types';

/**
 * Fake do SDK Supabase para testes de contrato dos adapters (doc §16.2/§16.3).
 *
 * Simula:
 *  - a cadeia fluente PostgREST (`from().insert().select()` etc.) sobre um
 *    "banco" em memória;
 *  - a RLS do Postgres §15.1: leitura pública só de anúncios visíveis,
 *    escrita de animals só do dono (ou admin);
 *  - respostas de `auth` (e-mail/senha — decisão §4) configuráveis.
 *
 * NÃO substitui a verificação real contra o Supabase — retrata a semântica
 * definida em `supabase/init.sql` para que erros de adapter, mapeamento e
 * bloqueio otimista (§14.3) sejam pegos no Jest.
 */

export type FakeRow = Record<string, any>;

export interface FakeSupabaseDb {
  animals: FakeRow[];
  users: FakeRow[];
  [table: string]: FakeRow[] | undefined;
}

export interface FakeSupabaseContext {
  db: FakeSupabaseDb;
  /** `auth.uid()` simulado; `null` = anônimo (visitante). */
  currentUserId: string | null;
  /** Papel ADMIN simulado (bypass das políticas de dono). */
  isAdmin: boolean;
}

export interface FakeSupabaseOptions {
  context: FakeSupabaseContext;
}

export interface FakeSupabaseAuthHandlers extends Partial<SupabaseAuthApi> {}

type FilterPair =
  | { column: string; op: 'eq' | 'neq'; value: unknown }
  | { column: string; op: 'in'; value: unknown[] };

type TableOp = 'select' | 'insert' | 'update' | 'delete';

interface FakeOperationArgs {
  ctx: FakeSupabaseContext;
  table: string;
  op: TableOp;
  payload?: Partial<FakeRow> | Partial<FakeRow>[];
  filters: FilterPair[];
}

class FakeFilter<TRow extends object> implements SupabaseFilter<TRow> {
  constructor(private args: FakeOperationArgs) {}

  eq(column: string, value: unknown): this {
    this.args.filters.push({ column, op: 'eq', value });
    return this;
  }

  neq(column: string, value: unknown): this {
    this.args.filters.push({ column, op: 'neq', value });
    return this;
  }

  in(column: string, values: unknown[]): this {
    this.args.filters.push({ column, op: 'in', value: values as unknown[] });
    return this;
  }

  // Não usados pelos adapters, mas mantidos para fidelidade da cadeia real.
  order(): this {
    return this;
  }

  limit(): this {
    return this;
  }

  select(): FakeFilter<TRow> {
    // No SDK real, select() sobre insert/update apenas pede eco das linhas —
    // o fake já devolve as linhas afetadas no resolve.
    return this;
  }

  /** Terminal thenable — executa a operação sobre o banco fake. */
  then<TResult1 = PostgrestResult<TRow[]>, TResult2 = never>(
    onfulfilled?: ((value: PostgrestResult<TRow[]>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null
  ): PromiseLike<TResult1 | TResult2> {
    const result = this.execute() as unknown as PostgrestResult<TRow[]>;
    return Promise.resolve(result).then(onfulfilled, onrejected);
  }

  private execute(): PostgrestResult<FakeRow[]> {
    const { ctx, table, op, filters } = this.args;
    const rows: FakeRow[] = ctx.db[table] ?? (ctx.db[table] = []);

    const matches = (row: FakeRow): boolean =>
      filters.every((f) => {
        if (f.op === 'eq') return row[f.column] === f.value;
        if (f.op === 'neq') return row[f.column] !== f.value;
        return Array.isArray(f.value) && f.value.map(String).includes(String(row[f.column]));
      });

    // ------------------------------------------------------------------
    // RLS simulada (§15.1):
    //  - `animals`: público lê só o visível; dono/admin leem tudo do seu;
    //  - privadas por usuário (`favorites`, `adoption_interests`):
    //    somente o próprio usuário (ou admin) lê e escreve;
    //  - demais tabelas: escrita restrita ao dono (`owner_id`) da linha.
    // ------------------------------------------------------------------
    const isPrivateRow = (row: FakeRow): boolean => row.user_id !== undefined;
    // `users`: policies users_*_own (id = auth.uid()).
    const isUserRow = table === 'users';
    const canSeeRow = (row: FakeRow): boolean => {
      if (isUserRow) return ctx.currentUserId !== null && row.id === ctx.currentUserId;
      if (ctx.isAdmin) return true;
      if (isPrivateRow(row)) {
        return ctx.currentUserId !== null && row.user_id === ctx.currentUserId;
      }
      if (ctx.currentUserId !== null && row.owner_id === ctx.currentUserId) return true;
      return row.moderation_status !== 'HIDDEN'; // anônimo/terceiro: público
    };
    const canWriteRow = (row: FakeRow): boolean => {
      if (isUserRow) return ctx.currentUserId !== null && row.id === ctx.currentUserId;
      if (ctx.isAdmin) return true;
      if (ctx.currentUserId === null) return false;
      if (row.user_id !== undefined) return row.user_id === ctx.currentUserId;
      return row.owner_id === ctx.currentUserId;
    };

    if (op === 'select') {
      return { data: rows.filter((r: FakeRow) => matches(r) && canSeeRow(r)), error: null };
    }

    if (op === 'insert') {
      const payloadList = Array.isArray(this.args.payload)
        ? this.args.payload
        : [this.args.payload as Partial<FakeRow>];
      const toInsert = payloadList.map((p) => ({ ...(p as FakeRow) }));
      for (const row of toInsert) {
        if (!canWriteRow(row)) {
          // RLS: qualquer tabela exige usuário autenticado e linha própria
          // (animals: dono/admin; favorites/adoption_interests: próprio usuário).
          return {
            data: null,
            error: {
              message: `new row violates row-level security policy for table "${table}"`,
            },
          };
        }
      }
      rows.push(...toInsert);
      return { data: toInsert, error: null };
    }

    if (op === 'update') {
      const target = rows.filter((r: FakeRow) => matches(r));
      const allowed = target.filter(canWriteRow); // RLS filtra as linhas alheias
      for (const row of allowed) {
        Object.assign(row, this.args.payload as FakeRow);
      }
      return { data: allowed, error: null }; // rejeitadas → zero linhas
    }

    // delete
    const target = rows.filter((r: FakeRow) => matches(r) && canWriteRow(r));
    if (ctx.db[table]) {
      ctx.db[table] = rows.filter((r: FakeRow) => !target.includes(r));
    }
    return { data: target, error: null };
  }
}

class FakeTable<TRow extends object> implements SupabaseTable<TRow> {
  constructor(private ctx: FakeSupabaseContext, private table: string) {}

  select(): SupabaseFilter<TRow> {
    return new FakeFilter<TRow>({ ctx: this.ctx, table: this.table, op: 'select', filters: [] });
  }

  insert(values: Partial<TRow> | Array<Partial<TRow>>): SupabaseInsertBuilder<TRow> {
    return new FakeFilter<TRow>({
      ctx: this.ctx,
      table: this.table,
      op: 'insert',
      payload: values as Partial<FakeRow>,
      filters: [],
    }) as unknown as SupabaseInsertBuilder<TRow>;
  }

  update(values: Partial<TRow>): SupabaseMutationBuilder<TRow> {
    return new FakeFilter<TRow>({
      ctx: this.ctx,
      table: this.table,
      op: 'update',
      payload: values as Partial<FakeRow>,
      filters: [],
    }) as unknown as SupabaseMutationBuilder<TRow>;
  }

  delete(): SupabaseFilter<TRow> {
    return new FakeFilter<TRow>({ ctx: this.ctx, table: this.table, op: 'delete', filters: [] });
  }
}

export class FakeSupabaseClient implements SupabaseClientLike {
  auth: SupabaseAuthApi;
  private ctx: FakeSupabaseContext;

  constructor(
    options: FakeSupabaseOptions & { authHandlers?: FakeSupabaseAuthHandlers }
  ) {
    this.ctx = options.context;
    this.auth = {
      signInWithPassword: jest.fn(async ({ email, password }: { email: string; password: string }) => {
        if (options.authHandlers?.signInWithPassword) {
          return options.authHandlers.signInWithPassword({ email, password });
        }
        return { data: { session: null }, error: { message: 'invalid login credentials' } };
      }),
      signUp: jest.fn(async (credentials: any) =>
        options.authHandlers?.signUp
          ? options.authHandlers.signUp(credentials)
          : { data: { user: null, session: null }, error: { message: 'signup disabled' } }
      ),
      signOut: jest.fn(async () =>
        options.authHandlers?.signOut
          ? options.authHandlers.signOut()
          : { error: null }
      ),
      getSession: jest.fn(async () =>
        options.authHandlers?.getSession
          ? options.authHandlers.getSession()
          : { data: { session: null }, error: null }
      ),
      getUser: jest.fn(async () =>
        options.authHandlers?.getUser
          ? options.authHandlers.getUser()
          : { data: { user: null }, error: { message: 'missing token' } }
      ),
    } as SupabaseAuthApi;
  }

  from<TRow extends object = Record<string, unknown>>(table: string): SupabaseTable<TRow> {
    return new FakeTable<TRow>(this.ctx, table);
  }
}

/** Módulo supabase-js fake (`createClient`) para injetar no `loadSupabaseClient`. */
export function createFakeSupabaseModule(
  client: SupabaseClientLike
): SupabaseModuleLike & { clients: SupabaseClientLike[] } {
  const clients: SupabaseClientLike[] = [];
  return {
    clients,
    createClient: (url: string, anonKey: string) => {
      // Anota as credenciais recebidas no MESMO cliente devolvido ao app
      // (o cliente real do SDK também é a própria instância entregue).
      const created = Object.assign(client, { __url: url, __anonKey: anonKey });
      clients.push(created);
      return created;
    },
  };
}

export function seedFakeDb(overrides: Partial<FakeSupabaseDb> = {}): FakeSupabaseDb {
  return {
    ...overrides,
    animals: overrides.animals ?? [],
    users: overrides.users ?? [],
  };
}
