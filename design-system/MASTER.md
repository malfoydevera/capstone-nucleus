# NUCLEUS Design System — Master Tokens

## Brand palette

| Token | Hex | Usage |
|-------|-----|-------|
| `primary` | `#3674B5` | Primary actions, nav active state, links, badges |
| `primary-light` | `#578FCA` | Hover states, secondary accents, gradients |
| `surface` | `#FFFFFF` | Cards, sidebar, modals |

## CSS variables (`frontend/src/index.css`)

- `--color-apple-blue`: `#3674B5` (primary)
- `--color-primary-light`: `#578FCA`
- `--color-surface`: `#FFFFFF`

## Typography

- Display & body: Inter, system-ui stack (see `:root` in `index.css`)

## Radius & shadow

- Standard card radius: `1.5rem`
- Soft shadow: `var(--shadow-soft)`

## Status tones (student submissions)

Use `frontend/src/utils/studentStatus.js` for consistent labels and badge classes across student views.
