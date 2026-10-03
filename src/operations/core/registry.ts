import type { CategoryId, OperationDefinition } from './types';
import { CATEGORIES } from './types';

const registry = new Map<string, OperationDefinition>();

export function defineOp(def: OperationDefinition): OperationDefinition {
  if (registry.has(def.id)) throw new Error(`Duplicate operation id: ${def.id}`);
  registry.set(def.id, def);
  return def;
}

export function getOp(id: string): OperationDefinition | undefined {
  return registry.get(id);
}

export function allOps(): OperationDefinition[] {
  return [...registry.values()];
}

export function opCount(): number {
  return registry.size;
}

export function opsByCategory(cat: CategoryId): OperationDefinition[] {
  return allOps().filter((o) => o.category === cat);
}

export function categoryCount(cat: CategoryId): number {
  return opsByCategory(cat).length;
}

export { CATEGORIES };

export interface SearchFilters {
  category?: CategoryId | 'all';
  reversibleOnly?: boolean;
  oneWayOnly?: boolean;
  engine?: EngineId | 'all';
}

type EngineId = OperationDefinition['engine'];

function score(hay: string, q: string, base: number): number {
  const h = hay.toLowerCase();
  const needle = q.toLowerCase();
  if (h === needle) return base + 40;
  if (h.startsWith(needle)) return base + 18;
  if (h.includes(needle)) return base;
  return 0;
}

/** Weighted search across name, aliases, tags and description. */
export function searchOps(query: string, filters: SearchFilters = {}): OperationDefinition[] {
  let pool = allOps();
  if (filters.category && filters.category !== 'all') pool = pool.filter((o) => o.category === filters.category);
  if (filters.reversibleOnly) pool = pool.filter((o) => o.reversible);
  if (filters.oneWayOnly) pool = pool.filter((o) => o.oneWay);
  if (filters.engine && filters.engine !== 'all') pool = pool.filter((o) => o.engine === filters.engine);

  const q = query.trim();
  if (!q) return pool.sort((a, b) => a.name.localeCompare(b.name));

  // Multi-token: every token must match something.
  const tokens = q.toLowerCase().split(/\s+/);
  const scored: { op: OperationDefinition; s: number }[] = [];
  for (const op of pool) {
    let total = 0;
    let failed = false;
    for (const t of tokens) {
      let s = 0;
      s = Math.max(s, score(op.name, t, 10));
      for (const a of op.aliases ?? []) s = Math.max(s, score(a, t, 8));
      for (const tag of op.tags ?? []) s = Math.max(s, score(tag, t, 6));
      s = Math.max(s, score(op.description, t, 3));
      if (op.historicalName) s = Math.max(s, score(op.historicalName, t, 5));
      // Action words: "decode", "hash", "compress", ...
      if (op.actions.some((a) => a.kind.startsWith(t) || a.label.toLowerCase().includes(t))) s = Math.max(s, 5);
      if (s === 0) {
        failed = true;
        break;
      }
      total += s;
    }
    if (!failed) scored.push({ op, s: total });
  }
  return scored.sort((a, b) => b.s - a.s).map((x) => x.op);
}

/** Related operations: same category, shared tags, or mutual aliases. */
export function relatedOps(op: OperationDefinition, limit = 4): OperationDefinition[] {
  const tags = new Set(op.tags ?? []);
  return allOps()
    .filter((o) => o.id !== op.id)
    .map((o) => {
      let s = 0;
      if (o.category === op.category) s += 3;
      for (const t of o.tags ?? []) if (tags.has(t)) s += 2;
      return { o, s };
    })
    .filter((x) => x.s > 0)
    .sort((a, b) => b.s - a.s)
    .slice(0, limit)
    .map((x) => x.o);
}
