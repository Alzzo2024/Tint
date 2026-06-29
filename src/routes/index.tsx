import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useLiveQuery } from "dexie-react-hooks";
import { useEffect, useMemo, useState } from "react";
import { ClientOnly } from "@tanstack/react-router";
import {
  Plus,
  Pencil,
  Copy,
  Trash2,
  Settings as SettingsIcon,
  Image as ImageIcon,
  RotateCcw,
  X,
} from "lucide-react";
import { db } from "@/lib/db";
import {
  createProject,
  deleteProject,
  duplicateProject,
  renameProject,
  restoreProject,
  purgeProject,
  PRESETS,
} from "@/lib/projects";
import { useTranslation } from "@/lib/i18n";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Tint — Galeria" },
      { name: "description", content: "Os teus projetos de desenho." },
    ],
  }),
  component: GalleryPage,
});

function GalleryPage() {
  return (
    <ClientOnly fallback={<GalleryShell />}>
      <GalleryClient />
    </ClientOnly>
  );
}

function GalleryShell() {
  return <div className="min-h-screen" />;
}

function GalleryClient() {
  const { t } = useTranslation();
  const projects = useLiveQuery(
    () => db().projects.orderBy("updatedAt").reverse().toArray(),
    [],
    [],
  );
  const live = projects ?? [];
  const active = live.filter((p) => !p.deletedAt);
  const trashed = live.filter((p) => p.deletedAt);
  const [newOpen, setNewOpen] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [purging, setPurging] = useState<string | null>(null);
  const [showTrash, setShowTrash] = useState(false);
  const [renameValue, setRenameValue] = useState("");

  return (
    <div className="min-h-screen px-4 pb-24 pt-6 sm:px-6">
      <header className="mx-auto flex max-w-5xl items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">
            <span className="text-gradient-brand">Tint</span>
          </h1>
          <p className="text-sm text-muted-foreground">{t("gallery.title")}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTrash(true)}
            aria-label="Reciclagem"
            title="Reciclagem"
            className="glass relative flex h-11 w-11 items-center justify-center rounded-full"
          >
            <Trash2 className="h-5 w-5" strokeWidth={2.5} />
            {trashed.length > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-gradient-brand px-1 text-[10px] font-bold text-primary-foreground">
                {trashed.length}
              </span>
            )}
          </button>
          <Link
            to="/settings"
            aria-label={t("editor.settings")}
            className="glass flex h-11 w-11 items-center justify-center rounded-full"
          >
            <SettingsIcon className="h-5 w-5" strokeWidth={2.5} />
          </Link>
        </div>
      </header>

      <main className="mx-auto mt-6 max-w-5xl">
        {active.length === 0 && (
          <div className="glass mt-12 flex flex-col items-center rounded-3xl p-10 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-brand text-primary-foreground">
              <ImageIcon className="h-8 w-8" strokeWidth={2.5} />
            </div>
            <p className="text-base text-muted-foreground">
              {t("gallery.empty")}
            </p>
            <button
              onClick={() => setNewOpen(true)}
              className="mt-6 rounded-full bg-gradient-brand px-6 py-2.5 text-sm font-semibold text-primary-foreground"
            >
              {t("gallery.new")}
            </button>
          </div>
        )}

        {active.length > 0 && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            <button
              onClick={() => setNewOpen(true)}
              className="glass group flex aspect-square flex-col items-center justify-center rounded-2xl text-muted-foreground transition hover:text-foreground"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-brand text-primary-foreground transition group-hover:scale-110">
                <Plus className="h-7 w-7" strokeWidth={2.75} />
              </div>
              <span className="mt-3 text-sm font-medium">
                {t("gallery.new")}
              </span>
            </button>
            {active.map((p) => (
              <ProjectCard
                key={p.id}
                id={p.id}
                name={p.name}
                width={p.width}
                height={p.height}
                thumbnail={p.thumbnail}
                onRename={() => {
                  setRenaming(p.id);
                  setRenameValue(p.name);
                }}
                onDelete={() => setDeleting(p.id)}
              />
            ))}
          </div>
        )}
      </main>

      {newOpen && <NewProjectDialog onClose={() => setNewOpen(false)} />}
      {renaming && (
        <RenameDialog
          value={renameValue}
          onChange={setRenameValue}
          onCancel={() => setRenaming(null)}
          onSubmit={async () => {
            if (renameValue.trim()) {
              await renameProject(renaming, renameValue.trim());
            }
            setRenaming(null);
          }}
        />
      )}
      {deleting && (
        <ConfirmDialog
          title={t("gallery.delete")}
          body={t("gallery.deleteConfirm")}
          confirmLabel={t("common.delete")}
          danger
          onCancel={() => setDeleting(null)}
          onConfirm={async () => {
            await deleteProject(deleting);
            setDeleting(null);
          }}
        />
      )}
      {purging && (
        <ConfirmDialog
          title="Eliminar permanentemente?"
          body="Esta acção não pode ser desfeita. As camadas serão apagadas."
          confirmLabel={t("common.delete")}
          danger
          onCancel={() => setPurging(null)}
          onConfirm={async () => {
            await purgeProject(purging);
            setPurging(null);
          }}
        />
      )}
      {showTrash && (
        <TrashDrawer
          items={trashed.map((p) => ({
            id: p.id,
            name: p.name,
            width: p.width,
            height: p.height,
            thumbnail: p.thumbnail,
            deletedAt: p.deletedAt!,
          }))}
          onClose={() => setShowTrash(false)}
          onRestore={async (id) => { await restoreProject(id); }}
          onPurge={(id) => setPurging(id)}
        />
      )}
    </div>
  );
}

function ProjectCard({
  id,
  name,
  width,
  height,
  thumbnail,
  onRename,
  onDelete,
}: {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: Blob;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const [menu, setMenu] = useState(false);
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!thumbnail) {
      setThumbUrl(null);
      return;
    }
    const url = URL.createObjectURL(thumbnail);
    setThumbUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [thumbnail]);

  return (
    <div className="group relative">
      <Link
        to="/p/$id"
        params={{ id }}
        className="glass block aspect-square overflow-hidden rounded-2xl"
      >
        {thumbUrl ? (
          <img
            src={thumbUrl}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-white">
            <ImageIcon className="h-8 w-8 text-black/20" strokeWidth={2.5} />
          </div>
        )}
      </Link>
      <div className="mt-2 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="text-xs text-muted-foreground">
            {width} × {height}
          </p>
        </div>
        <button
          onClick={() => setMenu((m) => !m)}
          aria-label="Mais opções"
          className="rounded-full p-1.5 text-muted-foreground hover:bg-white/5 hover:text-foreground"
        >
          <Pencil className="h-4 w-4" strokeWidth={2.5} />
        </button>
      </div>
      {menu && (
        <div className="glass-strong absolute right-0 top-full z-20 mt-1 w-44 rounded-xl p-1.5 text-sm">
          <MenuItem
            icon={<Pencil className="h-4 w-4" strokeWidth={2.5} />}
            label={t("gallery.rename")}
            onClick={() => {
              setMenu(false);
              onRename();
            }}
          />
          <MenuItem
            icon={<Copy className="h-4 w-4" strokeWidth={2.5} />}
            label={t("gallery.duplicate")}
            onClick={async () => {
              setMenu(false);
              await duplicateProject(id);
            }}
          />
          <MenuItem
            danger
            icon={<Trash2 className="h-4 w-4" strokeWidth={2.5} />}
            label={t("gallery.delete")}
            onClick={() => {
              setMenu(false);
              onDelete();
            }}
          />
        </div>
      )}
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left transition hover:bg-white/5 ${
        danger ? "text-destructive" : "text-foreground"
      }`}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function NewProjectDialog({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [name, setName] = useState(t("gallery.untitled"));
  const [preset, setPreset] = useState<"square" | "screen" | "a4" | "custom">(
    "square",
  );
  const [w, setW] = useState(2048);
  const [h, setH] = useState(2048);

  const dims = useMemo(() => {
    if (preset === "custom") return { width: w, height: h };
    const found = PRESETS.find((p) => p.id === preset)!;
    return { width: found.width, height: found.height };
  }, [preset, w, h]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-md rounded-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold">{t("newProject.title")}</h2>

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          {t("newProject.name")}
        </label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
        />

        <label className="mt-4 block text-xs font-medium text-muted-foreground">
          {t("newProject.preset")}
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {(
            [
              ["square", t("newProject.square")],
              ["screen", t("newProject.screen")],
              ["a4", t("newProject.a4")],
              ["custom", t("newProject.custom")],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPreset(id)}
              className={`rounded-xl border px-3 py-2 text-sm transition ${
                preset === id
                  ? "border-transparent bg-gradient-brand text-primary-foreground"
                  : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {preset === "custom" && (
          <div className="mt-3 grid grid-cols-2 gap-2">
            <div>
              <label className="block text-xs text-muted-foreground">
                {t("newProject.width")} ({t("newProject.pixels")})
              </label>
              <input
                type="number"
                value={w}
                min={32}
                max={8192}
                onChange={(e) => setW(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              />
            </div>
            <div>
              <label className="block text-xs text-muted-foreground">
                {t("newProject.height")} ({t("newProject.pixels")})
              </label>
              <input
                type="number"
                value={h}
                min={32}
                max={8192}
                onChange={(e) => setH(parseInt(e.target.value) || 0)}
                className="mt-1 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-sm outline-none"
              />
            </div>
          </div>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {dims.width} × {dims.height} px
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm"
          >
            {t("newProject.cancel")}
          </button>
          <button
            onClick={async () => {
              const id = await createProject({
                name: name.trim() || t("gallery.untitled"),
                width: dims.width,
                height: dims.height,
              });
              navigate({ to: "/p/$id", params: { id } });
            }}
            className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t("newProject.create")}
          </button>
        </div>
      </div>
    </div>
  );
}

function RenameDialog({
  value,
  onChange,
  onSubmit,
  onCancel,
}: {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="glass-strong w-full max-w-sm rounded-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{t("gallery.rename")}</h2>
        <input
          autoFocus
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onSubmit();
            if (e.key === "Escape") onCancel();
          }}
          className="mt-3 w-full rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-sm outline-none focus:border-white/30"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onSubmit}
            className="rounded-full bg-gradient-brand px-5 py-2 text-sm font-semibold text-primary-foreground"
          >
            {t("common.save")}
          </button>
        </div>
      </div>
    </div>
  );
}

function ConfirmDialog({
  title,
  body,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onCancel}
    >
      <div
        className="glass-strong w-full max-w-sm rounded-3xl p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{body}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm"
          >
            {t("common.cancel")}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-full px-5 py-2 text-sm font-semibold ${
              danger
                ? "bg-destructive text-destructive-foreground"
                : "bg-gradient-brand text-primary-foreground"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
