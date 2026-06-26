import { createFileRoute, Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Heart } from "lucide-react";
import { ClientOnly } from "@tanstack/react-router";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Tint — Definições" },
      { name: "description", content: "Personaliza o teu Tint." },
    ],
  }),
  component: SettingsPage,
});

function SettingsPage() {
  return (
    <ClientOnly fallback={<div className="min-h-screen" />}>
      <SettingsClient />
    </ClientOnly>
  );
}

function SettingsClient() {
  const { t, i18n } = useTranslation();
  const lang = i18n.resolvedLanguage ?? "pt-PT";

  return (
    <div className="min-h-screen px-4 pb-24 pt-6 sm:px-6">
      <header className="mx-auto flex max-w-2xl items-center gap-3">
        <Link
          to="/"
          aria-label={t("editor.back")}
          className="glass flex h-10 w-10 items-center justify-center rounded-full"
        >
          <ArrowLeft className="h-5 w-5" strokeWidth={2.5} />
        </Link>
        <h1 className="text-2xl font-bold">{t("settings.title")}</h1>
      </header>

      <main className="mx-auto mt-6 max-w-2xl space-y-5">
        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("settings.language")}
          </h2>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <LangBtn
              active={lang === "pt-PT"}
              onClick={() => i18n.changeLanguage("pt-PT")}
              label={t("settings.languagePt")}
            />
            <LangBtn
              active={lang === "en-GB"}
              onClick={() => i18n.changeLanguage("en-GB")}
              label={t("settings.languageEn")}
            />
          </div>
        </section>

        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("settings.gestures")}
          </h2>
          <ul className="mt-3 space-y-2 text-sm">
            <li className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span className="rounded-full bg-gradient-brand px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                2×
              </span>
              <span>{t("settings.twoFingerTap")}</span>
            </li>
            <li className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span className="rounded-full bg-gradient-brand px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                3×
              </span>
              <span>{t("settings.threeFingerTap")}</span>
            </li>
            <li className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span>✋</span>
              <span>{t("settings.palmRejection")}</span>
            </li>
            <li className="flex items-center gap-2 rounded-xl bg-white/5 px-3 py-2">
              <span>✎</span>
              <span>{t("settings.pressureSupport")}</span>
            </li>
          </ul>
        </section>

        <section className="glass rounded-3xl p-5">
          <h2 className="text-sm font-semibold text-muted-foreground">
            {t("settings.about")}
          </h2>
          <p className="mt-3 text-sm text-muted-foreground">
            Tint v0.1.0 — feito com{" "}
            <Heart className="inline h-3.5 w-3.5 text-pink-400" />.
          </p>
          <a
            href="https://revolut.me/simaoa_cz_ytr4"
            target="_blank"
            rel="noreferrer"
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-brand px-4 py-3 text-sm font-semibold text-primary-foreground"
          >
            <Heart className="h-4 w-4" strokeWidth={2.75} />
            {t("settings.supportDev")}
          </a>
        </section>
      </main>
    </div>
  );
}

function LangBtn({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-sm transition ${
        active
          ? "border-transparent bg-gradient-brand text-primary-foreground"
          : "border-white/10 bg-white/5 text-foreground hover:bg-white/10"
      }`}
    >
      {label}
    </button>
  );
}
