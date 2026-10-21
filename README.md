# Cryptographer

An app for constructing, saving and sharing cryptic crosswords. Built with Claude Fable 5.1.

## Development

```sh
npm install
npm run dev        # http://localhost:5173
npm test           # model unit tests
npm run build      # type-check and build to dist/
npm run preview    # serve dist/
```

## Deploying

Pushes to `main` run `.github/workflows/deploy.yml`, which builds the app and pushes `dist/` into the `cryptographer/` folder of the `mschachner/site` repo, so it is served at mark-schachner.com/cryptographer. The workflow needs the `SITE_DEPLOY_KEY` secret (the site repo's SSH deploy key) on this repo.

## Layout

- `src/model/` — puzzle types, slot and numbering computation, the corner rule, clue reattachment, share-link codec, themes and fonts. Pure functions; tested in `model.test.ts`.
- `src/render/` — drawing operations shared by every output: `grid.ts` renders a grid, `page.ts` lays out an export page, `svg.ts` turns operations into SVG.
- `src/export/` — raster (canvas) and PDF (pdf-lib, embedded fonts) backends.
- `src/store/` — localStorage persistence behind small store interfaces.
- `src/ui/` — the screens: library, editor, bank, settings, solve; dialogs for export and share.
- `public/fonts/` — bundled fonts, all under the SIL Open Font License (see `FONTS.md` and `OFL.txt`).

The in-app Help (top right) explains the editor, clues, bank, sharing and export with illustrations drawn by the live renderer.

## Editor keys

| Key | Action |
|---|---|
| Letter | Fill the cursor square (creating the cell) and advance |
| Arrows | Move; moving perpendicular to the current direction switches direction first |
| Enter / Tab | Toggle across/down |
| Backspace | Clear the letter; on an empty cell, remove it and step back |
| Delete | Remove the cell |
| Space | Toggle cell/void |
| Shift+arrows or Shift+drag | Select a rectangle (Space / Delete act on it) |
| ⌘Z / ⇧⌘Z | Undo / redo |
| Drag void, scroll | Pan · ⌘+scroll zooms |
