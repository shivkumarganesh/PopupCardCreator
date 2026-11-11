# Pop-Up Card Creator

A browser generator for real, buildable pop-up cards. Pick a template or start
blank, stand shapes, words, emoji, your own pictures or freehand drawings on the
card, watch it fold in 3D, and export a laser-ready SVG or a print-and-cut
template for scissors.

## How the cards work

Every element is a **parallelogram (box-tab) pop-up**, the mechanism behind
classic 90° pop-up and "origamic architecture" cards. An upright face hinges on
the floor panel and a strut ties it back to the wall; opposite sides of the
linkage are equal, so it lies flat at 180°, stands at 90° and closes flat at 0°
for any depth and height. That is what guarantees the output folds.

Each element is built one of two ways:

- **Glue-on** – a small tab is cut from the card and the shape is a separate
  piece (any paper colour) glued to its front. Pieces can overlap in depth; a
  piece standing behind another one's strut automatically gets a slot at its
  foot so it slides over the strut.
- **One sheet** – the silhouette itself is cut from the card and folds up, with
  the strut leaving from its top. No glue, but it needs its own patch of paper.

The builder checks what paper cannot do and says how to fix it: elements that
would stick out of the closed card, cuts that reach the edge, two elements
needing the same paper, pieces standing in the same spot, a strut that would cut
a piece in two. Export is blocked while an error remains.

## Output

- **Laser SVG** – millimetres, 1:1. Red `#FE0002` strokes are cuts, blue
  `#2366FF` strokes are score/fold lines (the Atomm / xTool colour spec). The
  pop-up sheet, the optional backing cover and the glue-on pieces (grouped by
  paper colour) are separate `<g>` groups laid side by side.
- **Print template** – one page per sheet, black lines at 100 %: solid = cut,
  dashed = valley fold, dash-dot = mountain fold.

## Code

`frontend/` – Vite + React + TypeScript + three.js.

- `src/core/` – pure geometry, no DOM (unit-tested):
  `trace.ts` bitmap → silhouette (marching squares), `build.ts` design → card
  model (cut/fold lines, 3D parts, checks), `pose.ts` fold kinematics,
  `sheet.ts` sheet layout + SVG / print output. Coordinate systems are
  documented at the top of `types.ts`.
- `src/app/` – shape library (occasion + scenery shapes), 13 bundled fonts, rasterisers (shape/text/image/drawing → mask),
  templates, state with undo and auto-placement, export wiring.
- `src/components/` – UI on the Atomm generator design system (`atomm.css` is
  the platform's layout-5 stylesheet): tool rail + panel, canvas with
  2D design / 3D preview / Export views, parameters rail.

The 2D editor, the 3D preview and the exported file all read the same model
from `buildCard()`.

```sh
cd frontend
npm install
npm run dev     # http://localhost:5173
npm test
npm run build   # static site in frontend/dist (relative paths)
```

## Publishing

- **GitHub Pages** – `.github/workflows/deploy.yml` builds and deploys
  `frontend/dist` on push.
- **Atomm creative tools** – `index.html` loads the platform SDK, the Export
  button slot is `[data-atomm-export-button]`, and the `export` hook returns
  the SVG (plus the print template on Download). Preview locally with
  `https://www.atomm.com/creativetools/community/generator/<name>?local=http://localhost:5173/`,
  then zip the contents of `frontend/dist` and upload it in the developer
  console. Opened outside the platform, the page shows its own "Export SVG"
  button instead.

`backend/` is an unused FastAPI skeleton kept for a possible future server.
