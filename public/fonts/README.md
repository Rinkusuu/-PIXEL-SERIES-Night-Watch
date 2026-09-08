# Fonts

Two bitmap faces, both under the SIL Open Font License 1.1, both self-hosted.

| File | Face | Used for |
|---|---|---|
| `press-start-2p-latin.woff2` | Press Start 2P | `--font-display` — the hero digits |
| `silkscreen-latin.woff2` | Silkscreen | `--font-ui` — panel titles, labels, buttons |

Latin subsets only, taken from the Google Fonts static host. The stylesheet is
**not** linked: a CDN font would be the app's only third-party request and the
DNA's global constraints forbid it.

## Why they are committed

They were not, and for the whole life of the project both `@font-face` rules
resolved to nothing. Every face fell through to `ui-monospace`, so the app ran
on SF Mono while its design language is bitmap pixel type — and nothing said
so, because `font-display: swap` degrades silently by design.

Eight kilobytes is a cheap price for the identity not being optional.

Licences: `OFL-press-start-2p.txt`, `OFL-silkscreen.txt`. Both permit bundling
and redistribution; both require the licence to travel with the font, which is
what those two files are doing here.
