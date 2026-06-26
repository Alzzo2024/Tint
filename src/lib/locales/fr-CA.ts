import type { Translation } from "./pt-PT";
import { frFR } from "./fr-FR";

export const frCA: Translation = {
  ...frFR,
  app: { name: "Tint", tagline: "Dessine n'importe où." },
  editor: {
    ...frFR.editor,
    settings: "Paramètres",
    saved: "Sauvegardé",
    saving: "Sauvegarde…",
  },
  newProject: { ...frFR.newProject, preset: "Préréglage" },
  settings: {
    ...frFR.settings,
    title: "Paramètres",
    appearance: "Apparence",
  },
  common: { ...frFR.common, save: "Sauvegarder" },
};
