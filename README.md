# marimo-cad

**Reactive Parametric CAD** for [marimo](https://marimo.io) notebooks.

Build interactive 3D CAD models with sliders that update in real-time without losing your camera position.

## Why marimo-cad?

marimo already displays build123d objects natively via `_repr_html_`. So when should you use this widget?

| Use Case | Native build123d | marimo-cad |
|----------|------------------|------------|
| Quick visualization | Just return the object | Overkill |
| **Parametric design with sliders** | Camera resets on every change | Camera preserved |
| Named multi-part assemblies | No | Yes, with tree view |
| Export (STL/STEP/GLTF) | Manual | Built-in |

**TL;DR**: Use native for static shapes, use marimo-cad for parametric design.

## Installation

```bash
git clone https://github.com/cemrehancavdar/marimo-cad
cd marimo-cad
uv sync
cd js && npm install && npm run build
```

## Quick Start

```python
import marimo as mo
from build123d import Box, Cylinder
import marimo_cad as cad

# Create sliders
width = mo.ui.slider(10, 50, value=20, label="Width")
height = mo.ui.slider(10, 50, value=30, label="Height")

# Create viewer once
viewer = cad.view()

# Build shape reactively
box = Box(width.value, width.value, height.value)
hole = Cylinder(5, height.value + 10)
model = box - hole

# Render - camera stays put when sliders change!
viewer.render(model)

mo.vstack([mo.hstack([width, height]), viewer])
```

## Features

- **Camera preservation** - adjust sliders without losing your view angle
- **Named assemblies** - multiple parts with tree view selection
- **Export** - STL, STEP, GLTF with one function call
- **Reactive updates** - only changed geometry is updated

## API

### Create Viewer

```python
import marimo_cad as cad

v = cad.view()                    # Default: 100% width, 600px height
v = cad.view(width=800)           # Fixed width
v = cad.view({"width": "50%"})    # CSS width
```

### Render Shapes

```python
# Single shape
v.render(box)

# Named assembly
v.render([
    {"shape": base, "name": "Base", "color": "blue"},
    {"shape": top, "name": "Top", "color": "red"},
])
```

### Export

```python
from marimo_cad import export_stl, export_step, export_gltf

export_stl(model, "part.stl")     # 3D printing
export_step(model, "part.step")   # CAD exchange
export_gltf(model, "part.glb")    # Web viewers
```

### Colors

`blue`, `red`, `green`, `yellow`, `orange`, `purple`, `cyan`, `pink`, `gray`, `white`, `black`, or hex `"#ff6600"`

## Examples

See `notebooks/` for interactive examples:

```bash
uv run marimo edit notebooks/vase.py      # Parametric vase with STL download
uv run marimo edit notebooks/bookshelf.py # Parametric bookshelf
```

## Development

```bash
uv run pytest                              # Run tests
uv run ruff check src/ notebooks/ --fix    # Lint
cd js && npm run build                     # Rebuild JS after changes
```

## License

MIT
