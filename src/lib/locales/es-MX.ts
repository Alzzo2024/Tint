import type { Translation } from "./pt-PT";
import { esES } from "./es-ES";

export const esMX: Translation = {
  ...esES,
  app: { name: "Tint", tagline: "Dibuja donde quieras." },
  tools: { ...esES.tools, pan: "Mano", text: "Texto" },
  text: {
    title: "Agregar texto",
    placeholder: "Escribe aquí…",
    font: "Tipo de letra",
    size: "Tamaño",
    bold: "Negrita",
    italic: "Cursiva",
    underline: "Subrayado",
    add: "Agregar",
  },
  common: { ...esES.common, add: "Agregar" },
};
