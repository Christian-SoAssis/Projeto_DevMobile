import {
  SupabaseClientLike,
  SupabaseModuleLike,
  SupabaseAuthApi,
  SupabaseStorageApi,
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
  /**
   * Relógio do SERVIDOR (opcional): quando presente, simula os triggers
   * `trg_animals_updated_at` (insert/update) e `trg_animal_photos_touch_animal`
   * do `init.sql` — `updated_at` passa a ser o carimbo do servidor, não o
   * enviado pelo app. Ausente, as linhas guardam o que o app mandou.
   */
  serverClock?: () => string;
}

export interface FakeSupabaseOptions {
  context: FakeSupabaseContext;
}

export interface FakeSupabaseAuthHandlers extends Partial<SupabaseAuthApi> {}

type FilterPair =
  | { column: string; op: 'eq' | 'neq' | 'gt'; value: unknown }
  | { column: string; op: 'in'; value: unknown[] }
  | { column: string; op: 'or'; value: OrNode[] };

/** Árvore mínima da sintaxe `or=(…)` do PostgREST (só o que os adapters usam). */
type OrNode =
  | { kind: 'and'; children: OrNode[] }
  | { kind: 'cmp'; column: string; op: 'eq' | 'neq' | 'gt'; value: string };

/** Divide no nível 0 de parênteses/aspas. */
function splitTopLevel(input: string): string[] {
  const parts: string[] = [];
  let depth = 0;
  let quoted = false;
  let current = '';
  for (const ch of input) {
    if (ch === '"') quoted = !quoted;
    if (!quoted && ch === '(') depth += 1;
    if (!quoted && ch === ')') depth -= 1;
    if (!quoted && depth === 0 && ch === ',') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) parts.push(current);
  return parts;
}

function parseOr(input: string): OrNode[] {
  return splitTopLevel(input).map((term): OrNode => {
    if (term.startsWith('and(') && term.endsWith(')')) {
      return { kind: 'and', children: parseOr(term.slice(4, -1)) };
    }
    const [column, op, ...rest] = term.split('.');
    let value = rest.join('.');
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (op !== 'eq' && op !== 'neq' && op !== 'gt') {
      throw new Error(`SupabaseFake: operador não suportado no or(): ${op}`);
    }
    return { kind: 'cmp', column, op, value };
  });
}

const TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;

/** Carimbo → microssegundos (o Postgres compara timestamptz com 6 casas). */
function timestampMicros(value: string): number {
  const m = value.match(/^(.*T\d{2}:\d{2}:\d{2})(?:\.(\d+))?(.*)$/);
  if (!m) return Number.NaN;
  const frac = (m[2] ?? '').padEnd(6, '0').slice(0, 6);
  const tz = m[3] || 'Z';
  return Date.parse(`${m[1]}${tz}`) * 1000 + Number(frac);
}

/** Comparação com a semântica do Postgres para os tipos usados (timestamptz, texto, número). */
function compareValues(a: unknown, b: unknown): number {
  if (typeof a === 'string' && typeof b === 'string' && TIMESTAMP.test(a) && TIMESTAMP.test(b)) {
    return Math.sign(timestampMicros(a) - timestampMicros(b));
  }
  if (typeof a === 'number' && typeof b === 'number') return Math.sign(a - b);
  const sa = String(a);
  const sb = String(b);
  return sa < sb ? -1 : sa > sb ? 1 : 0;
}

function evalCmp(row: FakeRow, column: string, op: 'eq' | 'neq' | 'gt', value: unknown): boolean {
  const cell = row[column];
  if (op === 'gt') return cell !== undefined && cell !== null && compareValues(cell, value) > 0;
  const equal =
    typeof cell === 'string' && typeof value === 'string' && TIMESTAMP.test(cell) && TIMESTAMP.test(value)
      ? compareValues(cell, value) === 0
      : cell === value;
  return op === 'eq' ? equal : !equal;
}

function evalOr(row: FakeRow, nodes: OrNode[]): boolean {
  const evalNode = (node: OrNode): boolean =>
    node.kind === 'and' ? node.children.every(evalNode) : evalCmp(row, node.column, node.op, node.value);
  return nodes.some(evalNode);
}

type TableOp = 'select' | 'insert' | 'update' | 'delete';

interface FakeOperationArgs {
  ctx: FakeSupabaseContext;
  table: string;
  op: TableOp;
  payload?: Partial<FakeRow> | Partial<FakeRow>[];
  filters: FilterPair[];
  orderBy?: Array<{ column: string; ascending: boolean }>;
  limitCount?: number;
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

  gt(column: string, value: unknown): this {
    this.args.filters.push({ column, op: 'gt', value });
    return this;
  }

  or(filters: string): this {
    this.args.filters.push({ column: '', op: 'or', value: parseOr(filters) });
    return this;
  }

  order(column: string, options?: { ascending?: boolean }): this {
    (this.args.orderBy ??= []).push({ column, ascending: options?.ascending ?? true });
    return this;
  }

  limit(count: number): this {
    this.args.limitCount = count;
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
        if (f.op === 'eq' || f.op === 'neq' || f.op === 'gt') return evalCmp(row, f.column, f.op, f.value);
        if (f.op === 'or') return evalOr(row, f.value);
        return Array.isArray(f.value) && f.value.map(String).includes(String(row[f.column]));
      });

    // Triggers do init.sql (OFF-06, ordem 6). Tombstones sempre; relógio do
    // servidor só quando `serverClock` foi configurado no contexto.
    const serverNow = (): string => ctx.serverClock?.() ?? new Date().toISOString();
    const tombstones = (): FakeRow[] => ctx.db.animal_tombstones ?? (ctx.db.animal_tombstones = []);
    const putTombstone = (animalId: unknown, reason: 'DELETED' | 'HIDDEN') => {
      const list = tombstones();
      const existing = list.find((t) => t.animal_id === animalId);
      if (existing) Object.assign(existing, { reason, removed_at: serverNow() });
      else list.push({ animal_id: animalId, reason, removed_at: serverNow() });
    };
    const dropTombstone = (animalId: unknown) => {
      ctx.db.animal_tombstones = tombstones().filter((t) => t.animal_id !== animalId);
    };
    const touchAnimal = (animalId: unknown) => {
      if (!ctx.serverClock) return;
      const animal = (ctx.db.animals ?? []).find((a: FakeRow) => a.id === animalId);
      if (animal) animal.updated_at = serverNow();
    };

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
    // `animal_photos`: leitura pública; escrita só do dono do anúncio (is_animal_owner).
    const isPhotoRow = table === 'animal_photos';
    const ownsAnimal = (animalId: unknown): boolean =>
      ctx.currentUserId !== null &&
      (ctx.db.animals ?? []).some((a: FakeRow) => a.id === animalId && a.owner_id === ctx.currentUserId);
    const canSeeRow = (row: FakeRow): boolean => {
      if (isPhotoRow) return true;
      // adoption_interests: o dono do anúncio também lê os interesses recebidos.
      if (table === 'adoption_interests' && ownsAnimal(row.animal_id)) return true;
      if (isUserRow) return ctx.currentUserId !== null && row.id === ctx.currentUserId;
      if (ctx.isAdmin) return true;
      if (isPrivateRow(row)) {
        return ctx.currentUserId !== null && row.user_id === ctx.currentUserId;
      }
      if (ctx.currentUserId !== null && row.owner_id === ctx.currentUserId) return true;
      return row.moderation_status !== 'HIDDEN'; // anônimo/terceiro: público
    };
    const canWriteRow = (row: FakeRow): boolean => {
      if (isPhotoRow) return ctx.isAdmin || ownsAnimal(row.animal_id);
      // Trilha (decisão 18): o responsável do anúncio atualiza a etapa
      // (policy interests_animal_owner_update no servidor).
      if (table === 'adoption_interests' && op === 'update') return ownsAnimal(row.animal_id);
      if (isUserRow) return ctx.currentUserId !== null && row.id === ctx.currentUserId;
      if (ctx.isAdmin) return true;
      if (ctx.currentUserId === null) return false;
      if (row.user_id !== undefined) return row.user_id === ctx.currentUserId;
      return row.owner_id === ctx.currentUserId;
    };

    if (op === 'select') {
      let selected = rows.filter((r: FakeRow) => matches(r) && canSeeRow(r));
      const orderBy = this.args.orderBy ?? [];
      if (orderBy.length > 0) {
        selected = [...selected].sort((a, b) => {
          for (const o of orderBy) {
            const c = compareValues(a[o.column], b[o.column]);
            if (c !== 0) return o.ascending ? c : -c;
          }
          return 0;
        });
      }
      if (this.args.limitCount !== undefined) selected = selected.slice(0, this.args.limitCount);
      return { data: selected, error: null };
    }

    if (op === 'insert') {
      const payloadList = Array.isArray(this.args.payload)
        ? this.args.payload
        : [this.args.payload as Partial<FakeRow>];
      const toInsert = payloadList.map((p) => ({ ...(p as FakeRow) }));
      // unique (user_id, animal_id) de favorites/adoption_interests.
      if (table === 'favorites' || table === 'adoption_interests') {
        for (const row of toInsert) {
          const dup = rows.some((r: FakeRow) => r.user_id === row.user_id && r.animal_id === row.animal_id);
          if (dup && canWriteRow(row)) {
            return {
              data: null,
              error: { code: '23505', message: 'duplicate key value violates unique constraint' },
            };
          }
        }
      }
      // PK `id` de animals: uma reenvio de CREATE com confirmação perdida
      // (cenário T04) chega como violação de chave primária — o mesmo código
      // 23505 que o Postgres real devolve.
      if (table === 'animals') {
        for (const row of toInsert) {
          const dup = rows.some((r: FakeRow) => r.id === row.id);
          if (dup) {
            return {
              data: null,
              error: {
                code: '23505',
                message: 'duplicate key value violates unique constraint "animals_pkey"',
              },
            };
          }
        }
      }
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
      if (table === 'animals') {
        for (const row of toInsert) {
          if (ctx.serverClock) row.updated_at = serverNow();
          dropTombstone(row.id); // recriado
        }
      }
      rows.push(...toInsert);
      if (table === 'animal_photos') toInsert.forEach((r) => touchAnimal(r.animal_id));
      return { data: toInsert, error: null };
    }

    if (op === 'update') {
      const target = rows.filter((r: FakeRow) => matches(r));
      const allowed = target.filter(canWriteRow); // RLS filtra as linhas alheias
      for (const row of allowed) {
        const wasHidden = row.moderation_status === 'HIDDEN';
        Object.assign(row, this.args.payload as FakeRow);
        if (table === 'animals') {
          if (ctx.serverClock) row.updated_at = serverNow();
          const isHidden = row.moderation_status === 'HIDDEN';
          if (isHidden && !wasHidden) putTombstone(row.id, 'HIDDEN');
          if (!isHidden && wasHidden) dropTombstone(row.id);
        }
        if (table === 'animal_photos') touchAnimal(row.animal_id);
      }
      return { data: allowed, error: null }; // rejeitadas → zero linhas
    }

    // delete
    const target = rows.filter((r: FakeRow) => matches(r) && canWriteRow(r));
    if (ctx.db[table]) {
      ctx.db[table] = rows.filter((r: FakeRow) => !target.includes(r));
    }
    if (table === 'animals') target.forEach((r) => putTombstone(r.id, 'DELETED'));
    if (table === 'animal_photos') target.forEach((r) => touchAnimal(r.animal_id));
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

export interface FakeStorageObject {
  bucket: string;
  contentType?: string;
  size: number;
}

/** Limites do bucket `animal-photos` (espelham o SQL de `supabase/init.sql`). */
export const FAKE_BUCKET = 'animal-photos';
export const FAKE_BUCKET_MAX_BYTES = 2 * 1024 * 1024;

export class FakeSupabaseClient implements SupabaseClientLike {
  auth: SupabaseAuthApi;
  storage: SupabaseStorageApi;
  /** Objetos gravados no "bucket", por caminho — para asserções nos testes. */
  storageObjects = new Map<string, FakeStorageObject>();
  private ctx: FakeSupabaseContext;

  constructor(
    options: FakeSupabaseOptions & { authHandlers?: FakeSupabaseAuthHandlers }
  ) {
    this.ctx = options.context;
    this.storage = {
      from: (bucket: string) => ({
        upload: async (path: string, body: ArrayBuffer | Uint8Array, opts?: { contentType?: string; upsert?: boolean }) => {
          const size = body instanceof Uint8Array ? body.byteLength : (body as ArrayBuffer).byteLength;
          const ownFolder = this.ctx.currentUserId !== null && path.split('/')[0] === this.ctx.currentUserId;
          if (bucket !== FAKE_BUCKET || !ownFolder) {
            // Política animal_photos_insert_own_folder (1ª pasta = auth.uid()).
            return { data: null, error: { message: 'new row violates row-level security policy' } };
          }
          if (opts?.contentType !== 'image/webp') {
            return { data: null, error: { message: `mime type ${opts?.contentType} is not supported` } };
          }
          if (size > FAKE_BUCKET_MAX_BYTES) {
            return { data: null, error: { message: 'The object exceeded the maximum allowed size' } };
          }
          if (this.storageObjects.has(path) && !opts?.upsert) {
            return { data: null, error: { message: 'The resource already exists' } };
          }
          this.storageObjects.set(path, { bucket, contentType: opts?.contentType, size });
          return { data: { path }, error: null };
        },
        remove: async (paths: string[]) => {
          for (const p of paths) {
            if (this.ctx.currentUserId !== null && p.split('/')[0] === this.ctx.currentUserId) this.storageObjects.delete(p);
          }
          return { error: null };
        },
        getPublicUrl: (path: string) => ({
          data: { publicUrl: `https://fake.supabase.co/storage/v1/object/public/${bucket}/${path}` },
        }),
      }),
    };
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
          : {
              data: {
                session: this.ctx.currentUserId
                  ? { access_token: 'fake-token', user: { id: this.ctx.currentUserId } }
                  : null,
              },
              error: null,
            }
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
