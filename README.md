# marimo-cad

**Reactive Parametric CAD** for [marimo](https://marimo.io) notebooks.

Build interactive 3D CAD models with sliders that update in real-time without losing your camera position.

## Why marimo-cad?

marimo already displays build123d objects via `_repr_html_`. So when should you use this?

| Use Case | Native build123d | marimo-cad |
|----------|------------------|------------|
| Quick visualization | Just return the object | Overkill |
| **Parametric design with sliders** | Camera resets on every change | Camera preserved |
| Named multi-part assemblies | No | Yes, with tree view |
| Export (STL/STEP/GLTF) | Manual | Built-in |

**TL;DR**: Use native for static shapes, use marimo-cad for parametric design.

## Installation

```bash
pip install marimo-cad
```

## Quick Start

```python
import marimo as mo
from build123d import Box, Cylinder
import marimo_cad as cad

# Create sliders
size = mo.ui.slider(10, 50, value=20, label="Size")

# Create viewer once
viewer = cad.Viewer()

# Build and render - camera stays put when slider changes!
box = Box(size.value, size.value, size.value)
viewer.render(box)

mo.vstack([size, viewer])
```

## API

### Create Viewer

```python
import marimo_cad as cad

viewer = cad.Viewer()                    # Default: 100% width, 600px height
viewer = cad.Viewer(width=800)           # Fixed width  
viewer = cad.Viewer(width="50%")         # CSS width
```

### Render Shapes

```python
# Single shape
viewer.render(box)

# Named assembly
viewer.render([
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

```bash
# Clone and run examples
git clone https://github.com/cemrehancavdar/marimo-cad
cd marimo-cad && uv sync && cd js && npm install && npm run build && cd ..

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
