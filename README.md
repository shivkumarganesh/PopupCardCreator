# Pop-Up Card Creator

Design parametric pop-up cards with a live 3D fold simulation and export
laser-ready SVG flat patterns for cutters like the xTool M1 Ultra / F2.

## Structure

- `frontend/` — Vite + React + TypeScript + React Three Fiber.
  - `src/core/` — pure-TS geometry engine (single source of truth for both
    the 3D visualizer and the 2D SVG flat pattern): types, flat-pattern
    builder, laser-ready SVG serializer.
  - `src/components/three/` — R3F components (`BaseCard`, scene).
  - Split-pane UI: 3D canvas with a 0–180° opening-angle slider on the left,
    live flat pattern + SVG export on the right.
- `backend/` — FastAPI service for project persistence (JSON file storage).

## Laser conventions

All export coordinates are millimetres (mm-true `viewBox`), hairline
`0.1` strokes, `fill="none"`. Operations are color-coded:

| Color | Hex | Operation |
| --- | --- | --- |
| Red | `#FF0000` | Cut (outer boundary and through-cuts, always closed paths) |
| Blue | `#0000FF` | Mountain fold (score) |
| Green | `#00FF00` | Valley fold (score) |

Score lines stop 0.5 mm short of cut edges so corners are not over-weakened.
Layers are ordered valley → mountain → cut so scores run before the cut
releases the part.

## Run

```sh
# Frontend
cd frontend
npm install
npm run dev        # http://localhost:5173

# Backend
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload   # http://localhost:8000/api/health
```

## Kinematic model (roadmap)

Mechanisms are modeled as linkages — panels are rigid links, creases are
revolute joints:

- **V-fold** — spherical four-bar linkage; all creases concurrent at a vertex
  on the gutter. Loop closure: `cos B = cos A·cos δ + sin A·cos(Θ/2)·sin δ`
  (A = base sector angle, B = popup sector angle, Θ = card opening angle,
  δ = central-crease elevation). Constraints: `B ≥ A` to open to 180° without
  tearing; asymmetric variants need `A_L + B_L = A_R + B_R` to fold flat.
- **Parallel/box fold** — planar four-bar in the cross-section perpendicular
  to the gutter. Flat-fold condition `p + a = q + b`; containment
  `max(p+a, q+b) ≤` half card width.
