# Tint — App de Desenho

## Esclarecimento importante sobre "Android/iOS"

Lovable constrói **web apps**, não apps nativas para as lojas. A abordagem realista:

- Construir o Tint como **PWA (Progressive Web App)** otimizada para mobile — instalável no ecrã inicial em Android e iOS, funciona offline, suporta gestos multi-toque e Pointer Events API (que cobre sensibilidade à pressão de stylus: Apple Pencil, S-Pen, etc.).
- Para publicar nas lojas mais tarde, embrulha-se a PWA com Capacitor (Android/iOS nativos) — sem reescrever código.

Confirma se este caminho serve. Se quiseres mesmo binários `.apk`/`.ipa` desde o início, isso fica fora do que o Lovable produz.

## Arquitetura

- **Stack:** TanStack Start + React + Tailwind v4 + Canvas 2D / OffscreenCanvas.
- **Backend:** Lovable Cloud (Supabase por baixo) → transição para Supabase próprio é trocar o URL/chaves, schema migra na íntegra.
- **Storage:** projetos e camadas em IndexedDB local (Dexie) para performance de desenho; sync opcional para Cloud (thumbnails + ficheiros .tint comprimidos). Auto-save corre a cada N segundos para IndexedDB, com debounce de upload para a nuvem.
- **i18n:** `i18next` com `pt-PT` (default) e `en-GB`, seletor em Definições.
- **Design system:** fundo `#1a1a1a`, gradiente principal `#fec9ff → #ca8fff → #00f0ff` em tokens oklch no `src/styles.css`. Estética glass smooth (backdrop-blur, bordas translúcidas, sombras suaves). Ícones bold consistentes (Lucide com `strokeWidth={2.5}`).

## Schema (Cloud, pronto para Supabase)

```text
projects(id, user_id, name, width, height, thumbnail_url, created_at, updated_at)
project_files(id, project_id, storage_path, version, updated_at)
palettes(id, user_id, name, colors jsonb)
recent_colors(user_id, colors jsonb)
```
Com RLS por `user_id` e `user_roles` separado (sem roles na tabela de profiles).

## Funcionalidades — entrega faseada

Dada a dimensão, proponho **3 fases**. Cada fase é entregue funcional e testável.

### Fase 1 — Núcleo de desenho (esta entrega)
- Galeria: criar, duplicar, apagar, renomear projetos; modelos 1:1, 16:9, A4 + custom WxH.
- Canvas com pan/zoom/rotate (2 dedos), reset view, fullscreen.
- Pincéis: Lápis, Caneta, Aerógrafo, Marcador, Borracha — com sensibilidade à pressão via Pointer Events e palm rejection (filtro por `pointerType`).
- Sliders de tamanho/opacidade + estabilizador de traço.
- Undo/Redo (botões + gesto 2 toques / 3 toques).
- Auto-save em IndexedDB.
- Exportar PNG (com transparência opcional) e JPEG.
- Roda de cores HSV, histórico de cores recentes, conta-gotas (botão + press-and-hold).
- i18n pt-PT / en-GB, ecrã de Definições.
- Design glass smooth completo, gradiente da marca, ícones bold.

### Fase 2 — Camadas e seleção
- Painel de Layers completo (criar, apagar, duplicar, reordenar drag, opacidade, visibilidade, limpar, merge down).
- Balde de tinta com tolerância (flood fill).
- Seleção retangular + laço, mover/redimensionar seleção, copiar/colar entre camadas.
- Flip horizontal, réguas (linha/círculo/quadrado), simetria espelhada V/H.
- Paletas personalizadas guardadas.

### Fase 3 — Cloud sync e polish
- Sync opcional dos projetos para Lovable Cloud (login).
- Botão opcional "Apoiar programador" em Definições (placeholder de anúncio).
- PWA manifest + service worker para instalação no ecrã inicial.

## Detalhes técnicos relevantes
- Render por camada num `OffscreenCanvas`; composição final num canvas visível para manter 60fps em mobile.
- Histórico Undo/Redo baseado em snapshots por camada com limite (ex. 40) para não rebentar memória.
- Gestos: biblioteca leve própria sobre Pointer Events (não usar libs que dependam de mouse events).
- Estabilizador: média ponderada das últimas N posições do ponteiro, N exposto em slider.

## O que faço a seguir
Se aprovares, ativo o Lovable Cloud, monto o design system + scaffolding da app, e entrego a **Fase 1** completa e jogável. Depois iteramos Fase 2 e 3.

Confirma também:
1. PWA está OK como "Android/iOS" (vs. nativo via Capacitor mais tarde)?
2. Login é necessário desde já, ou começamos 100% local e adicionamos auth na Fase 3?
