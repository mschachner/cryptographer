# Cryptographer — design document

Cryptographer is a web app for constructing, saving, and sharing cryptic crosswords. It is built for Thea, from her wish list, and is maintained by Mark.

This document fixes the vocabulary, the data model, the behavior of each screen, and the order of work. Where a choice is still open it is listed under *Open questions* at the end rather than decided silently.

---

## 1. Goals

1. Construct a crossword by typing answers directly into a grid, in the manner of [quiver](https://github.com/varkor/quiver): no setup dialog, no fixed dimensions, no separate "place black squares" step. Where you type, there is a cell.
2. Derive the clue list from the grid automatically and let the constructor fill in the clues.
3. Keep a library of every puzzle the constructor has made.
4. Keep a clue bank — answers with clues, built up over time — and assemble new puzzles from it.
5. Share a finished puzzle by link, and export it as PDF or JPEG, in color or in black and white.
6. Look the way Thea asked: her five-color palette and Merriweather by default, both changeable.

### Non-goals (for now)

- Automatic grid filling from a dictionary. The constructor fills the grid; the app helps only from the constructor's own clue bank.
- Barred grids (Listener-style). Only blocked/void grids are supported in v1.
- Accounts, server-side storage, or multi-device sync. See §9 for how far a static app gets and what sync would require.
- Clue-writing assistance (anagram finders, wordplay checkers).

---

## 2. Thea's wishes, as requirements

| # | Wish | Requirement | Section |
|---|------|-------------|---------|
| 1 | Construct like quiver: a grid, type answers into squares | Free-form grid editor; a cell exists where a letter has been typed | §4 |
| 2 | Clue list generated from the grid; input clues | Automatic numbering and slot detection; clue editor beside the grid | §5 |
| 3 | Library of previous puzzles | Library screen with autosave | §6 |
| 4 | Clue bank; assemble a puzzle from it | Bank screen; bank suggestions inside the editor | §7 |
| 5 | Rounded corners on cell corners that touch no other cell | Per-corner rounding rule, applied in the editor and in every export | §4.4 |
| 6, 6.5 | Share by link; export PDF or JPEG | Self-contained share URL; PDF, JPEG, PNG export | §8, §9 |
| 6.75 | Black/white option when exporting | Built-in "Print" theme selectable at export time | §8.3 |
| 7 | Her palette, or a custom theme | Theme = named color roles; her palette is the default theme | §10.1 |
| 8 | Merriweather for clues, Merriweather UltraBold Italic for answers; changeable | Font roles with those defaults; any role overridable | §10.2 |
| 9 | All numbers in Merriweather, including cell numbers | Cell numbers and clue numbers use the *numbers* font role, default Merriweather Regular | §10.2 |

---

## 3. Concepts and data model

### 3.1 Vocabulary

- **Cell** — a square at integer coordinates `(row, col)` that holds one letter. Anything not a cell is **void**. There are no "black squares" as a separate kind of thing; the void plays that role. (A theme may paint void cells black to imitate a traditional grid, but the model does not distinguish.)
- **Grid** — the finite set of cells of a puzzle, with their letters.
- **Slot** — a maximal horizontal or vertical run of two or more cells. Every slot is either *across* or *down*.
- **Number** — the clue number assigned to a cell that begins at least one slot (standard crossword numbering; §5.1).
- **Entry** — a slot together with its number, direction, answer (the letters in its cells), enumeration, and clue.
- **Enumeration** — the word-length pattern printed after a cryptic clue, e.g. `(5,4)` or `(3-6)`. Default is the slot length as a single number; the constructor edits it.
- **Puzzle** — a grid plus its entries, a title, optional author/notes, timestamps, and a theme/font selection.
- **Bank entry** — an answer and a clue, kept independently of any puzzle, with enumeration, optional notes and tags, and a record of which puzzles use it.
- **Theme** — a named assignment of colors to the color roles in §10.1.
- **Font set** — an assignment of fonts to the font roles in §10.2.

### 3.2 Puzzle (persisted form)

Puzzles are stored and shared as JSON. Sketch:

```jsonc
{
  "schema": 1,
  "id": "p_9f3k2a",
  "title": "Untitled",
  "author": "",
  "notes": "",
  "created": "2026-10-20T22:00:00Z",
  "modified": "2026-10-20T22:41:00Z",
  "cells": [                      // sparse; only cells that exist
    { "r": 0, "c": 0, "l": "S" },
    { "r": 0, "c": 1, "l": "" }   // a cell may exist with no letter yet
  ],
  "clues": {                      // keyed by "<number><A|D>"; derived slots are not stored
    "1A": { "clue": "…", "enum": "5,4" },
    "1D": { "clue": "…", "enum": "" }  // "" means "use slot length"
  },
  "theme": "thea",                // theme id, or an inline custom theme object
  "fonts": "default"              // font-set id, or an inline custom font-set object
}
```

Slots and numbers are **not** stored; they are recomputed from `cells` whenever the grid changes (§5.1). Clues are keyed by number+direction, so a grid edit that renumbers the puzzle must remap the clue keys; §5.3 describes the remapping rule.

### 3.3 Clue bank entry

```jsonc
{
  "id": "b_1x8",
  "answer": "STARGAZER",
  "enum": "9",
  "clue": "…",
  "notes": "",
  "tags": ["anagram"],
  "created": "…",
  "usedIn": ["p_9f3k2a"]
}
```

`answer` is stored uppercase with no spaces or hyphens; `enum` carries the word breaks.

---

## 4. The grid editor

### 4.1 Canvas

The editor shows an unbounded plane of faint square outlines, in the manner of quiver's canvas. The puzzle's cells are drawn on it as solid squares. The canvas pans (drag on void, or scroll) and zooms (pinch, ⌘±, or a slider), and offers a "fit" action that frames the puzzle.

There is no dimension dialog. A new puzzle is an empty canvas with the cursor at the origin.

### 4.2 Cursor, direction, and typing

The editor has one **cursor** (the selected square) and one **direction** (across or down). The selected square is drawn in the *accent* color; the slot through it in the current direction is drawn in the *highlight* color.

| Action | Effect |
|---|---|
| Click a square | Move the cursor there. Clicking the cursor square again toggles direction. |
| Type a letter | Put the letter in the cursor square — creating the cell if the square was void — then advance one square in the current direction. |
| Arrow keys | Move the cursor one square. Moving along the current direction keeps it; moving perpendicular to it switches direction. |
| Enter or Tab | Toggle direction. |
| Backspace | Clear the cursor square's letter if it has one; otherwise move back one square and clear it. Does not remove the cell. |
| Delete or ⌫ on an empty cell | Remove the cell (make it void). |
| Space | Toggle the cursor square between cell and void. |
| Shift+arrow / drag | Select a rectangle. Space on a selection creates or voids every square in it; Delete voids it; typing is ignored. |
| ⌘Z / ⇧⌘Z | Undo / redo. Every grid or clue change is one undo step. |

A letter typed into a square that already has a letter replaces it. Only A–Z are accepted; input is uppercased.

### 4.3 Symmetry (optional)

A toggle in the editor toolbar enables **180° rotational symmetry** about the puzzle's current center. While it is on, creating or voiding a square does the same to its image. Letters are never mirrored. This is a convenience for building a conventional grid, not a requirement; the default is off, because quiver-style construction is free-form.

### 4.4 Rounded corners

Each cell is drawn with four independently rounded or square corners.

> A corner of a cell is **rounded** when neither of the two cells that would share that corner along an edge exists.

Precisely, for a cell at `(r, c)`:

- top-left is rounded iff `(r−1, c)` is void and `(r, c−1)` is void;
- top-right iff `(r−1, c)` is void and `(r, c+1)` is void;
- bottom-left iff `(r+1, c)` is void and `(r, c−1)` is void;
- bottom-right iff `(r+1, c)` is void and `(r, c+1)` is void.

The diagonal neighbor is deliberately ignored: a cell that touches another only at a corner point still has that corner rounded. A one-cell island is a rounded square; a lone horizontal strip has rounded ends and square inner corners; the outside corners of a full rectangle are rounded and nothing else is.

The radius is a theme parameter (default 22% of the cell size). The rule is applied by one function used by the editor, the solve view, and every export, so the three never disagree.

### 4.5 Validity

A grid is **well-formed** when every cell belongs to at least one slot (no cell is isolated in both directions) and every cell has a letter. The editor does not prevent ill-formed grids — construction is messy — but it marks problems:

- a cell in no slot is drawn with a dashed outline;
- an empty cell is drawn with a dot;
- a slot whose clue is blank is listed in the clue panel with a placeholder.

Sharing and exporting are allowed from any state; the share and export dialogs show a warning line summarizing what is unfinished.

### 4.6 Rendering

The grid is rendered as **SVG** in all contexts — editor, solve view, PDF, and raster export — from one rendering function `renderGrid(puzzle, theme, fonts, options) → SVGElement`. Options cover: show letters, show numbers, cell size, and which cells to highlight. Rendering to SVG once, rather than to DOM for the editor and canvas for export, is what keeps the rounded-corner rule, numbering, and fonts identical across the four outputs.

---

## 5. Clues

### 5.1 Numbering and slots

After every grid change:

1. Find slots: for each cell, it begins an across slot if the cell to its left is void and the cell to its right exists; likewise down. Extend each to its maximal run. Runs of length one are not slots.
2. Number: scan cells row-major (top to bottom, left to right). A cell that begins at least one slot receives the next integer. A cell beginning both an across and a down slot receives one number used by both.
3. Produce the entry lists: *Across* and *Down*, each ordered by number, each entry carrying its number, direction, answer (from cell letters, `·` for empty), and length.

This is the standard convention and matches what solvers expect of a printed cryptic.

### 5.2 Clue panel

The clue panel sits beside the grid and lists the Across and Down entries. For each entry it shows: number, the answer as currently typed in the grid, a clue text field, and an enumeration field. Clicking an entry moves the cursor to its first cell and sets the direction; moving the cursor in the grid scrolls the panel to the matching entry. The clue text field accepts plain text; the enumeration field accepts digits, commas, hyphens and apostrophes (`5,4`, `3-6`, `5'1`).

The printed form of a clue is `<number>. <clue text> (<enum>)`. Enumeration is appended automatically; the constructor never types the parentheses.

### 5.3 Keeping clues attached through renumbering

Clues are keyed by `number+direction`, but numbers shift when the grid is edited above or to the left of an entry. To keep a clue attached to the entry it was written for:

- Internally each clue is held against the **starting cell and direction** of its slot, not its number. The number is a display property.
- When a grid edit changes slots, each existing clue is reattached to the slot that begins at the same cell in the same direction, if there is one. If the starting cell moved (the slot was extended at the front) the clue follows the slot that contains the old starting cell in the same direction, provided there is exactly one.
- A clue whose slot has ceased to exist is kept in an **orphaned clues** list at the bottom of the panel, with its old answer, until the constructor deletes it, reattaches it by dragging it onto an entry, or sends it to the bank. Nothing a constructor typed is silently discarded.

The persisted form (§3.2) is keyed by number because that is what a share link or export needs; the start-cell keying is an in-memory concern.

---

## 6. Library

The library is the app's home screen. It lists every puzzle in local storage as a card: a small rendering of the grid (letters hidden), title, dimensions of the bounding box, entry count, completion state (how many entries have clues), and last-modified date. Cards sort by last modified; a search field filters by title and by any answer in the grid.

Actions per puzzle: open, duplicate, rename, export (same dialog as §8), share (§9), delete (with undo for a few seconds rather than a confirmation dialog).

Library-wide actions: new puzzle, import a puzzle JSON or share link, export the whole library as one JSON file, import such a file (merging by puzzle id).

The editor **autosaves** on every change, debounced; there is no Save button. The library is the record.

---

## 7. Clue bank

### 7.1 Bank screen

A table of bank entries: answer, enumeration, clue, tags, and the puzzles it has been used in. Sortable and searchable (by any substring of answer or clue, and by a pattern such as `S?A??` for an answer shape). Entries can be added by hand, edited in place, tagged, and deleted. The bank exports and imports as JSON like the library.

### 7.2 From puzzle to bank

In the clue panel each entry has a **Bank this** action that copies its answer, enumeration and clue to the bank (or updates the existing bank entry with the same answer). A puzzle-level **Bank all clues** does the same for every clued entry. The bank entry records the puzzle id in `usedIn`.

### 7.3 From bank to puzzle

This is the "assemble a puzzle from the bank" wish, and it has two halves.

1. **Suggestions while constructing.** When the cursor is in a slot, the clue panel shows bank entries whose answer fits the slot: same length, and agreeing with every letter already in the slot. Choosing one writes the answer into the grid and attaches the clue and enumeration to the entry. Entries already used in another puzzle are shown but marked, so repeats are a choice rather than an accident.
2. **Seeding a new puzzle.** From the bank, select some entries and choose **New puzzle from selection**. The app opens a new puzzle with those answers listed in a side tray; dragging an answer onto the canvas places it across or down (toggle with the usual key) starting at the drop square, and the clue comes with it. The constructor then connects the placed answers by typing further entries as usual. The app does not attempt to lay the answers out automatically; §1 lists auto-fill as a non-goal.

Suggestions require a bank of some size to be useful; until then the slot suggestion list is simply empty.

---

## 8. Export

### 8.1 Formats

- **PDF** — the puzzle laid out on white US Letter pages (the theme colours the grid and text; the page itself is paper white), portrait (grid above two clue columns) or landscape (grid at the left, clue columns beside it). Clues that do not fit continue onto further pages.
- **JPEG** and **PNG** — a raster of the same layout, or of the grid alone, at a chosen pixel width (default 1600 px). PNG is included because it is lossless and the right choice for a grid; JPEG is there because it was asked for.
- **SVG** — the grid alone. Cheap to offer since it is the native rendering, and the right input for anyone wanting to print at any size.

### 8.2 Options

Every export goes through one dialog with these options:

- **Content:** grid only, or grid with clues.
- **Letters:** blank (for solving) or filled (answer key). Default blank.
- **Theme:** the app's current theme, any saved theme, or **Print (black and white)**.
- **Orientation:** portrait or landscape, for PDF and for a raster of the full page.
- **Size:** pixel width for raster.
- **Details:** title, author and whether to print the date. Title and author edits are written back to the puzzle.

The dialog shows a live preview of the first page (or of the grid, for grid-only exports), redrawn as options change, with the same renderer that produces the file.

### 8.3 Black and white

"Print" is a built-in theme (§10.1): white page, white cells, black cell outlines and letters, no highlights. The black/white option on export is simply selecting this theme for the export. This keeps a single rendering path and means the B/W output follows the same corner rule and fonts.

### 8.4 Pipeline

1. Build the page as a DOM subtree: the SVG grid from `renderGrid`, and the clue lists as HTML with the proper fonts.
2. **Raster:** serialize that subtree into a foreign-object SVG, draw it onto a `<canvas>`, call `toBlob` with the chosen type. Fonts are embedded as data URLs in the serialized SVG so the canvas draws them.
3. **PDF:** generate the document client-side with the Merriweather TTFs (and any custom-chosen fonts that are bundled) embedded, so the PDF is self-contained and renders identically everywhere. The grid is drawn as vector paths, not as an image.
4. Trigger a download. Nothing is uploaded anywhere.

A fallback **Print…** action opens the browser print dialog on the same page layout with a print stylesheet; it exists for the case where a user wants a paper size or printer setting the dialog does not offer.

---

## 9. Sharing

### 9.1 Share link

A share link carries the whole puzzle in the URL fragment:

```
https://<host>/cryptographer/#p=<base64url(deflate(puzzle JSON))>
```

A 15×15 cryptic with thirty clues compresses to roughly 2–4 KB, well within what browsers and messaging apps carry. Nothing is stored on a server, so the link works forever and the app can be served as static files. The fragment is never sent to the server, so the puzzle's contents stay between sender and recipient.

The link opens the **solve view** (§9.2). The recipient can also **save a copy to their library**, which turns it into a normal puzzle on their device.

The share dialog offers: copy link, a QR code of the link, and a toggle for whether the link **includes the answers**. With answers, the solve view can check and reveal; without, it is only a fillable grid. Links with answers are decodable by anyone who cares to, which is the same trade-off every static puzzle site makes; the toggle exists so the constructor can choose.

### 9.2 Solve view

The solve view is the editor's grid and clue panel, read-only in structure: the solver types letters into cells but cannot create or void cells or edit clues. It offers check (mark wrong letters), reveal (one entry or all), and clear. Progress is saved in local storage keyed by a hash of the puzzle, so reopening the same link resumes. It uses the puzzle's theme and fonts as the constructor set them.

### 9.3 Limits of a static app, and what sync would need

With no backend, the library and bank live in one browser on one device. For two people sharing a bank, or one person working from two machines, the choices are:

1. Manual: export JSON, send it, import it. Works now, no infrastructure.
2. A sync file in a folder the user already syncs (Dropbox, iCloud Drive), written through the File System Access API. Chromium only, but Thea's and Mark's primary browsers can be checked against that.
3. A small backend (key-value per user) behind a login. Real multi-device sync, real operating cost and maintenance.

v1 does (1). The data layer is written behind an interface (`PuzzleStore`, `BankStore`) so that (2) or (3) can replace it without touching the UI.

---

## 10. Theming and typography

### 10.1 Color roles and themes

A theme assigns a color to each of these roles:

| Role | Used for |
|---|---|
| `page` | App background and export page background |
| `surface` | Panels, cards, dialogs |
| `cell` | Cell fill |
| `cellOutline` | Cell borders |
| `ink` | Letters and clue text |
| `number` | Cell numbers (may equal `ink`) |
| `accent` | The cursor cell; primary buttons |
| `highlight` | The current slot |
| `muted` | Secondary text, dashed outlines, the empty-canvas grid |
| `block` | Void squares inside the puzzle's bounding box. When it equals `page` the void is left as page and cells float (the Thea look); when it differs, enclosed void squares are painted as blocks (the Print and Classic look) |
| `cornerRadius` | Not a color: the rounding radius as a fraction of cell size |
| `texture` | Not a color: the id of a transparent background tile (from transparenttextures.com, bundled in `public/textures/`) laid over `page` in the app chrome. Textures are not applied to exports. Nineteen are bundled. |

The default theme, **Heather**, is built from Thea's palette:

| Hex | Name | Roles |
|---|---|---|
| `#EBE5D9` | Alabaster | `page`, `block` (cells are a lighter `#FBF8F2` so they read against the page) |
| `#A2ABA1` | Ash gray | `muted`, `cellOutline` |
| `#758976` | Reseda green | `surface` accents, secondary buttons, cell numbers on the Heather theme |
| `#CCBBDB` | Thistle | `highlight` |
| `#9E83B8` | African Violet | `accent` |

The palette contains no dark color, so `ink` on the Heather theme is a near-black derived from Reseda green (`#2B332C`), chosen so letters and clue text read at full contrast on Alabaster. This is the one color in the default theme not taken from the swatch, and it is called out here so it can be changed if Thea prefers something else.

An enclosed void square is bordered on all four sides by its neighbours' outlines, so without a distinct `block` color it would be indistinguishable from a cell. On the Heather theme the contrast between `cell` and `page` carries this; the Print and Classic themes paint `block` black, which is also what makes the black-and-white export unambiguous on paper.

Other built-in themes: **Newsprint** (cream, black blocks, red cursor), **Marine**, **Terracotta**, **Meadow**, **Slate** (dark), **Print** (§8.3) and **Classic** (white cells, black blocks, square corners). Each theme has a "light text on dark colours" switch (on for every built-in theme): when the accent is dark enough, primary buttons and tiles use the lighter of the theme's page and ink colours for their text and icons. Letters and numbers in the grid always use the ink colour, including on the cursor cell. Users create custom themes in a settings panel with one color picker per role and a live preview; custom themes are saved by name and can be exported and imported as JSON.

A theme is a property of the app, chosen in Settings, not of a puzzle: the editor, the solving view and the library all use the app's theme, and a shared puzzle is shown in the recipient's theme. The export dialog is the one place a different theme can be chosen, for the file being produced. A puzzle's stored `theme` and `fonts` fields are kept for compatibility but no longer read.

### 10.2 Font roles

| Role | Default | Used for |
|---|---|---|
| `clues` | Merriweather Regular (400) | Clue text, titles, app text |
| `answers` | Merriweather Black Italic (900 italic) | Letters in cells |
| `numbers` | Merriweather Regular (400) | Cell numbers and clue numbers |

"Merriweather UltraBold" is the original name of the weight that Google Fonts now lists as Merriweather Black (900); UltraBold Italic is Black Italic. The app bundles its fonts (all SIL Open Font License) rather than loading them from Google, so the editor works offline and the PDF exporter has the files to embed. Bundled families: Merriweather, Lora, Libre Baskerville, EB Garamond, Playfair Display, Bitter, Atkinson Hyperlegible and Alfa Slab One, each in the regular, italic and bold cuts that exist (static instances generated from the variable fonts where Google Fonts ships only those). Headings and clue numbers use the 700 cut of a role's family when one is bundled.

Each role can be changed independently in settings. The font picker offers: the bundled fonts, a curated list of open-licensed web fonts the app can fetch and cache (so they can also be embedded in PDFs), and a free-text "system font" entry for anything installed locally — with the caveat, shown in the picker, that a system font cannot be embedded in a PDF and will be substituted on other machines.

Cell letters are sized to the cell (roughly 60% of cell height, centered optically rather than geometrically, since Black Italic sits differently from Regular); cell numbers sit in the top-left corner at roughly 28% of cell height. Both are set in SVG so they scale with the grid.

---

## 11. Screens

1. **Home** — a centred landing screen: the app's name drawn as a row of cells by the grid renderer, three tiles (New puzzle, Library with its count, Clue bank with its count), the most recent puzzles, and links to Help and Settings.
2. **Library** — §6. Per-puzzle actions (share, export, duplicate, delete) live in a small menu on each card.
3. **Editor** — canvas on the left, clue panel on the right; a toolbar with: title field, direction indicator, symmetry toggle, fit-to-puzzle, undo/redo, theme, share, export. On narrow screens the clue panel becomes a bottom sheet.
4. **Clue bank** — §7.1.
5. **Solve** — §9.2; reached only by share link or by "preview as solver" from the editor.
6. **Settings** — themes (§10.1), fonts (§10.2), import/export of all data. The theme editor is folded behind a Customize button: a live preview beside colour chips, an inline hue/saturation/lightness picker, the corner radius, and a texture picker.

Navigation is a small top bar: Library · Bank · Settings, with the current puzzle title in the middle when one is open.

---

## 12. Architecture

- **Static web app, no backend.** Deployed the same way as Mark's other projects (GitHub Pages via the site repo workflow, at `mark-schachner.com/cryptographer`, or a dedicated domain if one is wanted).
- **TypeScript**, built with Vite. The UI layer is small enough for plain DOM with a thin reactive state store; a framework is not required and is left as a decision (§13).
- **Modules:**
  - `model/` — puzzle types, slot and numbering computation (§5.1), the corner rule (§4.4), clue reattachment (§5.3), serialization and the share-link codec (§9.1). Pure functions, fully unit-tested; this is where correctness matters.
  - `render/` — `renderGrid` to SVG; page layout for export.
  - `store/` — `PuzzleStore`, `BankStore`, `ThemeStore` over IndexedDB (with a localStorage fallback), import/export.
  - `ui/` — the five screens.
  - `export/` — raster and PDF pipelines (§8.4).
- **Dependencies, kept few:** a deflate implementation for share links; a PDF library capable of embedding TTFs; a QR encoder. Everything else is platform.
- **Tests:** unit tests for `model/` (numbering on known grids, corner rule on the cases in §4.4, round-trip of the share codec, clue reattachment under each edit type); a snapshot test that renders a reference puzzle to SVG so visual regressions in the grid are caught.

---

## 13. Milestones

Each milestone is usable on its own.

1. **Grid and clues.** Canvas, typing, numbering, clue panel, autosave of a single puzzle, Heather theme, Merriweather. Export to PNG/JPEG and SVG, blank or filled, color or Print.
2. **Library and sharing.** Library screen, multiple puzzles, import/export JSON, share link, solve view with check/reveal.
3. **PDF.** Full-page export with clues, embedded fonts, paper sizes.
4. **Clue bank.** Bank screen, bank-this, slot suggestions, new-puzzle-from-selection.
5. **Themes and fonts.** Custom theme editor, Classic theme, font roles and picker, symmetry toggle.

Wishes 1, 2, 5, 7, 8, 9 and the raster half of 6 are met at milestone 1; 3 and 6 at milestone 2; 6.5 and 6.75 fully at milestone 3; 4 at milestone 4.

---

## 14. Decisions taken for the prototype

The questions below were open in the first draft; the prototype goes with the recommended answer for each. Any of them can be revisited.

1. **Void appearance** — plain page background; cells float and are rounded where exposed. The Newsprint, Print and Classic themes paint enclosed void squares as blocks (§10.1, `block`).
2. **Ink color** — `#2B332C`.
3. **Share links** — include answers by default; the share dialog has a toggle.
4. **Enumeration** — comma, hyphen and apostrophe separators: `5,4`, `3-6`, `5'1`.
5. **Export metadata** — title, author and date (date of last modification).
6. **UI framework** — none: TypeScript and plain DOM with small render functions per screen, built with Vite.
7. **Hosting** — the site-repo workflow at `mark-schachner.com/cryptographer` (`.github/workflows/deploy.yml` builds on push to `main` and pushes `dist/` into the site repo over its deploy key); the build uses a relative base so it also runs from any subdirectory or from `vite preview`.
8. **PDF** — generated client-side with pdf-lib, Merriweather TTFs embedded and subset. No print-stylesheet fallback yet.
9. **Sync** — manual JSON export/import (whole library, bank alone, or a single puzzle via share link).

### Bundled sample

`public/samples/sample.json` holds a 5×5 sample cryptic. On first run, when the library is empty, it is copied into the library so the app opens with something to look at; a flag in local storage keeps it from being re-added.

### Prototype simplifications

- Persistence is localStorage, behind the `store/db.ts` interface described in §12.
- "New puzzle from selection" places a bank answer at the cursor with a click rather than by dragging onto the canvas (§7.3).
- The font picker offers the bundled families and a free-text system font; a list of fetchable (non-bundled) web fonts is not built.
- A Help dialog, reachable from every screen, explains the editor, clues, corner rule, library, bank, sharing, export and themes, with illustrations rendered by the same grid renderer in the current theme. Its copy is the one place the app carries explanatory prose; everything else is labels.
- Labels avoid file-format and implementation terms: "Back up everything" / "Restore from backup" rather than JSON import/export, "Lengths" for the enumeration field in the bank, colour roles shown as "Cursor", "Current entry", "Blocks" and so on.
- A raster export of grid-and-clues renders the first page only; multi-page clue lists need the PDF export.
- The `cornerRadius` slider, custom theme editor and font sets are in Settings; a puzzle records its theme id, so a custom theme travels in a share link only when the puzzle's theme is inlined (not yet done — recipients fall back to Thea if they lack the theme).
