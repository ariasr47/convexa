# Convexa theme tokens — binding reference (USE THESE, never hardcode)

File `4Njtm8QGWIgm4rA0UESg8n`. The design system lives in **🎨 Foundations** (70 vars / 5 collections + Type/Mono text styles + Effect styles).
**Root cause of past drift:** scripts hardcoded hex (`{r:…}`) + built text in **Roboto**. The DS font is **Inter** (Roboto Mono for figures). Bind to the tokens below instead.

## Binding recipes
- **Color (fills/strokes):** `const v = await figma.variables.getVariableByIdAsync(ID); const p = node.fills.map(f=> f.type==="SOLID" ? figma.variables.setBoundVariableForPaint(f,'color',v) : f); node.fills = p;` (setBoundVariableForPaint returns a NEW paint — reassign). Color collection has **Dark/Light modes** → bound nodes theme automatically.
- **Spacing / radius:** `node.setBoundVariable('itemSpacing', spacingVar)` · `'paddingLeft'|'paddingTop'|…` · `'topLeftRadius'|'topRightRadius'|'bottomLeftRadius'|'bottomRightRadius'` (radius is 4 props, not `cornerRadius`).
- **Typography:** `await textNode.setTextStyleIdAsync(STYLE_ID)` — applies Inter family + size/weight/line-height. (Load Inter Regular/Medium/Semi Bold/Bold first.)
- **Shadows:** `await node.setEffectStyleIdAsync(EFFECT_ID)`.

## Color (semantic — Dark/Light modes) — VariableID
| token | id | use |
|---|---|---|
| color/bg/default | `VariableID:20:172` | page background |
| color/bg/paper | `VariableID:20:173` | cards / panels |
| color/bg/raised | `VariableID:20:174` | **inputs / recessed** (darker than paper) |
| color/bg/hatch-alt | `VariableID:20:175` | hatch/alt surfaces |
| color/primary/main | `VariableID:20:176` | primary blue (buttons/links/active) |
| color/primary/tint | `VariableID:20:177` | tint fills (chips, icon tiles) |
| color/primary/contrast | `VariableID:20:178` | text on primary |
| color/success/main | `VariableID:20:179` | +P/L green |
| color/error/main | `VariableID:20:180` | −P/L red / destructive |
| color/warning/main | `VariableID:20:181` | amber (COMING SOON) |
| color/info/main | `VariableID:20:182` | cyan info |
| color/accent/violet | `VariableID:20:183` | avatar/accent |
| color/text/primary | `VariableID:20:184` | headings / values |
| color/text/secondary | `VariableID:20:185` | muted body |
| color/text/disabled | `VariableID:20:186` | labels / dim captions |
| color/divider | `VariableID:20:187` | borders / dividers |

## Spacing / Radius — VariableID
spacing/xs `19:172` · sm `19:173` · md `19:174` · lg `19:175` · xl `19:176` · 2xl `19:177` · 3xl `19:178` · layout/content-max `19:179` · layout/nav-height `19:180` · layout/gutter `19:181`
radius/control `19:182` · radius/card `19:183` · radius/pill `19:184`

## Text styles (Inter + Roboto Mono) — Style ID (use setTextStyleIdAsync)
| style | id | font / size |
|---|---|---|
| Type/Hero | `S:6ef4c1c2b0b36d447a3a9fb5f04cb9d2eb42ef40,` | Inter Bold 50 |
| Type/H1 | `S:47f1cb8713538af448619c250953ff193942ea8c,` | Inter Bold 32 |
| Type/Section | `S:22d92c39ccb6f1a6a4aaced9dc0890b900f7a9bf,` | Inter Semi Bold 18 |
| Type/Body | `S:90039d49a99ae35f937d3b85e36c944a2987f9d5,` | Inter Regular 14 |
| Type/Caption | `S:a529c7b0bd64e20362facd068aa7f5d58c9aca86,` | Inter Regular 13 |
| Type/Tile label | `S:f6c4cd6c8411014dae04c0c9127a00a22ce95006,` | Inter Regular 12 |
| Type/Button | `S:748fff695b708ff289c04c471fdfd3a575244c08,` | Inter Semi Bold 14 |
| Mono/Value | `S:bf9716763d3cc397343be242224326d9b94e4382,` | Roboto Mono Bold 19 |
| Mono/Value Large | `S:9648053113a46dd1362a7011184981e6ac3045c0,` | Roboto Mono Bold 27 |
| Mono/Inline | `S:5dedfe92a9b74c0f8fc8d6f92f1d38f95dfba0c7,` | Roboto Mono Medium 14 |

## Effect styles — Style ID (setEffectStyleIdAsync)
Effect/Dialog Shadow `S:8fe297d6ae004f8da28bb9eca825fe988af57383,` · Effect/Card Elevation `S:19c54545dc7791ee54f13d84b13816ec6f365fb0,` · Effect/Focus Ring `S:823dafdcf3dc1d30553235ef5b8c77f17fe0c9ac,`

## MUI kit re-theme — DONE (owner publishes the kit; it IS editable)
Kit file: **`eJ9qzhA6rNxwk2KVQA9AvU`** ("Material UI for Figma (and MUI X) (Community)"). Fully variable-driven:
`palette` collection (modes **light=`6636:3`, dark=`6636:4`**) semantic tokens + `typography` (font `fontFamily`=`VariableID:6636:20893`).
**Applied 2026-06-30 (direct brand values, both modes):** primary `#1d6fe0/#4f9cff`, secondary/violet `#7b5cff`, error `#d23b3b/#ff5c5c`, warning `#ed6c02/#ffa726`, info `#0288d1/#29b6f6`, success `#1e9e57/#2ecc71` (each main + derived dark/light + white contrastText); text primary/secondary/disabled; background default/paper; divider; **fontFamily → Inter**. 25 color vars + divider + font. Verified: kit Button renders brand-blue + Inter.
**PENDING owner action (API can't publish):** in the kit file → **Publish library**; then in the design file → **Update** the library. After update, all MUI instances across the screens inherit brand+Inter.
**Follow-ups after update:** (1) the kit palette default mode is **light** — set the design-file screen frames to the kit's **dark** mode (`setExplicitVariableModeForCollection(palette, 6636:4)`) so dark screens resolve dark brand values; (2) optional: publish Foundations as a library + re-alias the kit's palette to `color/*` for true single-source (instead of direct values); (3) refine warning contrastText (white on amber is low-contrast).
~~(superseded) build local brand wrapper components~~ — not needed now that the kit itself is themed.

## PER-BUILD CHECKLIST (every new/edited component)
1. NO hex literals, NO bare px for spacing/radius, NO `fontName=Roboto`.
2. Fills/strokes → `setBoundVariableForPaint` to `color/*`.
3. Padding/gap → `setBoundVariable` to `spacing/*`; radius → `radius/*` (4 corner props).
4. Text → `setTextStyleIdAsync` to `Type/*` (Inter) or `Mono/*` (figures). Load Inter first.
5. Shadows → `setEffectStyleIdAsync` to `Effect/*`.
6. Surfaces: page=`bg/default`, card=`bg/paper`, input/recessed=`bg/raised`, border=`divider`.
7. MUI instances → use local brand wrappers (token-bound), not raw kit instances.
