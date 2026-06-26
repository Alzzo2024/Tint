import { nanoid } from "nanoid";
import { db, type LayerRow, type ProjectRow } from "./db";

export const PRESETS = [
  { id: "square", width: 2048, height: 2048 },
  { id: "screen", width: 1920, height: 1080 },
  { id: "a4", width: 2480, height: 3508 },
] as const;

export type PresetId = (typeof PRESETS)[number]["id"];

async function emptyLayerBlob(width: number, height: number): Promise<Blob> {
  const c = new OffscreenCanvas(width, height);
  // Camada vazia (transparente)
  return await c.convertToBlob({ type: "image/png" });
}

export async function createProject(opts: {
  name: string;
  width: number;
  height: number;
}): Promise<string> {
  const id = nanoid(12);
  const now = Date.now();
  const project: ProjectRow = {
    id,
    name: opts.name,
    width: opts.width,
    height: opts.height,
    createdAt: now,
    updatedAt: now,
  };
  const layer: LayerRow = {
    id: nanoid(12),
    projectId: id,
    name: "Layer 1",
    order: 0,
    opacity: 1,
    visible: true,
    blob: await emptyLayerBlob(opts.width, opts.height),
  };
  await db().transaction("rw", db().projects, db().layers, async () => {
    await db().projects.put(project);
    await db().layers.put(layer);
  });
  return id;
}

export async function duplicateProject(id: string): Promise<string | null> {
  const orig = await db().projects.get(id);
  if (!orig) return null;
  const newId = nanoid(12);
  const now = Date.now();
  const newProject: ProjectRow = {
    ...orig,
    id: newId,
    name: `${orig.name} (copy)`,
    createdAt: now,
    updatedAt: now,
  };
  const layers = await db().layers.where("projectId").equals(id).toArray();
  const newLayers: LayerRow[] = layers.map((l) => ({
    ...l,
    id: nanoid(12),
    projectId: newId,
  }));
  await db().transaction("rw", db().projects, db().layers, async () => {
    await db().projects.put(newProject);
    await db().layers.bulkPut(newLayers);
  });
  return newId;
}

export async function renameProject(id: string, name: string) {
  await db().projects.update(id, { name, updatedAt: Date.now() });
}

export async function deleteProject(id: string) {
  await db().transaction("rw", db().projects, db().layers, async () => {
    await db().projects.delete(id);
    await db().layers.where("projectId").equals(id).delete();
  });
}

export async function touchProject(id: string, thumbnail?: Blob) {
  const patch: Partial<ProjectRow> = { updatedAt: Date.now() };
  if (thumbnail) patch.thumbnail = thumbnail;
  await db().projects.update(id, patch);
}
