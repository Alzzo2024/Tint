import type { Translation } from "./pt-PT";
import { enGB } from "./en-GB";

export const enUS: Translation = {
  ...enGB,
  app: { name: "Tint", tagline: "Draw anywhere." },
  editor: { ...enGB.editor, stabilizer: "Stabilizer", flipH: "Flip horizontally" },
  settings: { ...enGB.settings, appearance: "Appearance" },
  color: { ...enGB.color },
};
