import Dexie, { type Table } from "dexie";

/**
 * Local store. Estrutura desenhada para mapear 1:1 num schema Supabase futuro:
 *   projects(id, name, width, height, thumbnail, created_at, updated_at)
 *   layers(id, project_id, name, order, opacity, visible, blob)
 *   palettes(id, name, colors[])
 *   recent_colors(id=0, colors[])
 *
 * Quando o utilizador ligar uma conta, fazemos upload do mesmo formato.
 */

export interface ProjectRow {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: Blob;
  createdAt: number;
  updatedAt: number;
}

export interface LayerRow {
  id: string;
  projectId: string;
  name: string;
  order: number;
  opacity: number;
  visible: boolean;
  /** PNG blob com pixels da camada à resolução do projeto */
  blob: Blob;
}

export interface PaletteRow {
  id: string;
  name: string;
  colors: string[];
  createdAt: number;
}

export interface KVRow {
  key: string;
  value: unknown;
}

class TintDB extends Dexie {
  projects!: Table<ProjectRow, string>;
  layers!: Table<LayerRow, string>;
  palettes!: Table<PaletteRow, string>;
  kv!: Table<KVRow, string>;

  constructor() {
    super("tint");
    this.version(1).stores({
      projects: "id, updatedAt, createdAt, name",
      layers: "id, projectId, order",
      palettes: "id, createdAt, name",
      kv: "key",
    });
  }
}

let _db: TintDB | null = null;
export function db(): TintDB {
  if (typeof window === "undefined") {
    throw new Error("Tint DB only available in the browser.");
  }
  if (!_db) _db = new TintDB();
  return _db;
}

export async function kvGet<T>(key: string): Promise<T | undefined> {
  const row = await db().kv.get(key);
  return row?.value as T | undefined;
}

export async function kvSet<T>(key: string, value: T): Promise<void> {
  await db().kv.put({ key, value });
}
