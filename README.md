# Marimo 3D CAD

A 3D CAD viewer for [Marimo](https://marimo.io) notebooks, powered by [build123d](https://github.com/gumyr/build123d) and [three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer).

## Features

- Programmatic 3D CAD modeling with build123d
- Interactive 3D viewing in Marimo notebooks
- **Camera preservation** - view stays locked during geometry updates
- **Stateful part sync** - add/remove parts without full scene rebuild
- **Parametric gears** via bd_warehouse
- STEP, STL, GLTF import/export

## Installation

```bash
# Clone and install
git clone <repo-url>
cd marimo-3d-cad

# Install with uv
uv sync

# Build the JS widget
cd js && npm install && npm run build
```

## Quick Start

```python
import marimo_cad as cad
from build123d import Box, Cylinder, fillet

# Build a box with a hole
box = Box(15, 15, 15)
hole = Cylinder(4, 20)
model = fillet((box - hole).edges(), 0.5)

# Create viewer and render
v = cad.view()
v.render(model)
v  # marimo auto-displays last expression
```

## API

### Create a Viewer

```python
import marimo_cad as cad

# Default: fills container width, 600px height
v = cad.view()

# Custom size
v = cad.view(width=800, height=500)
v = cad.view({"width": "50%", "height": 400})
```

### Render Shapes

```python
# Single shape
v.render(box)

# Multiple shapes
v.render([box, cylinder])

# With metadata
v.render({
    "shape": box,
    "name": "Base",
    "color": "blue",
    "alpha": 0.8,  # optional transparency
})

# Assembly with mixed inputs
v.render([
    {"shape": base, "name": "Base", "color": "blue"},
    {"shape": pillar, "name": "Pillar", "color": "yellow"},
    cylinder,  # plain shape, auto-named
])
```

### One-liner (view + render)

```python
# Create viewer with initial shapes
v = cad.view(box)
v = cad.view([box, cylinder], {"width": 800})
```

### Available Colors

`blue`, `red`, `green`, `yellow`, `orange`, `purple`, `cyan`, `pink`, `gray`, `white`, `black`

Or use hex: `"#ff6600"`

## Parametric Gears

Using [bd_warehouse](https://github.com/gumyr/bd_warehouse) for proper involute gear profiles:

```python
from bd_warehouse.gear import SpurGear
from build123d import Cylinder
import marimo_cad as cad

gear = SpurGear(
    module=2,
    tooth_count=16,
    pressure_angle=20,
    thickness=8,
)

# Add center bore
bore = Cylinder(2.5, 10)
gear_with_bore = gear - bore

v = cad.view()
v.render({"shape": gear_with_bore, "name": "Gear 16T", "color": "orange"})
v
```

## Export

```python
from marimo_cad import export_step, export_stl, export_gltf

export_step(model, "part.step")  # Lossless CAD exchange
export_stl(model, "part.stl")    # 3D printing
export_gltf(model, "part.glb")   # Web/3D viewers
```

## Import

```python
from build123d import import_step, import_stl
import marimo_cad as cad

model = import_step("part.step")
v = cad.view(model)
v
```

## Development

```bash
# Install dev dependencies
uv sync --extra dev

# Build JS bundle (after changes to js/src/)
cd js && npm run build

# Run demo
uv run marimo edit notebooks/demo.py

# Run tests
uv run pytest

# Lint
uv run ruff check src/ notebooks/ --fix
```

## Architecture

```
marimo-3d-cad/
├── src/marimo_cad/
│   ├── __init__.py    # Public API: view, COLORS, export_*
│   ├── widget.py      # CADViewer anywidget + view() factory
│   ├── tessellate.py  # build123d → three-cad-viewer format
│   ├── export.py      # STEP/STL/GLTF export wrappers
│   └── static/        # Bundled JS widget
├── js/src/
│   ├── index.js       # anywidget render function
│   └── live-viewer.js # Extended Viewer with part sync
├── notebooks/
│   └── demo.py        # Interactive marimo demo
└── pyproject.toml
```

## License

MIT
