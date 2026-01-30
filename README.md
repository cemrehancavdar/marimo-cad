# marimo-cad

**Reactive Parametric CAD** for [marimo](https://marimo.io) notebooks.

Build interactive 3D CAD models with sliders that update in real-time without losing your camera position.

![Parametric Bookshelf Demo](assets/demo.gif)

## Why marimo-cad?

| Use Case | Native build123d | marimo-cad |
|----------|------------------|------------|
| Quick visualization | Just return the object | Overkill |
| **Parametric design with sliders** | Camera resets on every change | Camera preserved |
| Named multi-part assemblies | No | Yes, with tree view |
| Export (STL/STEP/GLTF) | Manual | Built-in |

## Installation

```bash
uv add marimo-cad
```

## Quick Start

```python
import marimo as mo
from build123d import Box
import marimo_cad as cad

size = mo.ui.slider(10, 50, value=20, label="Size")
viewer = cad.Viewer()

box = Box(size.value, size.value, size.value)
viewer.render(box)

mo.vstack([size, viewer])
```

## Examples

See [notebooks/](notebooks/) for complete examples:
- `bookshelf.py` - Parametric bookshelf
- `vase.py` - Parametric vase with STL export

## Viewer Features

- **Mouse**: Rotate (drag), pan (right-drag), zoom (scroll)
- **Tree view**: Toggle part visibility
- **Clipping planes**: Slice along X/Y/Z
- **Measurement**: Distance and angles

## Limitations

- Large models (>100k triangles) may be slow to tessellate
- Selection events not yet exposed to Python

## Development

```bash
uv sync && cd js && npm install && npm run build && cd ..
uv run pytest tests/           # 34 tests
uv run ruff check src/ --fix   # Lint
```

---

## API Reference

### Viewer

```python
viewer = cad.Viewer(width="100%", height=600)
viewer.render(shapes)
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `width` | `str \| int` | `"100%"` | CSS width or pixels |
| `height` | `int` | `600` | Height in pixels |

**render(shapes)** - Render shapes, preserving camera position.

```python
# Single shape
viewer.render(box)

# Multiple shapes
viewer.render([box, cylinder])

# Named parts with colors
viewer.render([
    {"shape": base, "name": "Base", "color": "blue"},
    {"shape": top, "name": "Top", "color": "red", "alpha": 0.8},
])
```

### PartSpec

Dict for specifying parts with metadata:

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `shape` | `Shape` | Yes | build123d object |
| `name` | `str` | No | Display name |
| `color` | `str` | No | Color name or hex |
| `alpha` | `float` | No | Opacity 0.0-1.0 |

### COLORS

Available named colors: `blue`, `red`, `green`, `yellow`, `orange`, `purple`, `cyan`, `pink`, `gray`, `white`, `black`

```python
{"shape": box, "color": "blue"}      # Named
{"shape": box, "color": "#ff6600"}   # Hex
```

### Export Functions

```python
from marimo_cad import export_stl, export_step, export_gltf

export_stl(obj, "part.stl")                    # 3D printing
export_stl(obj, "fine.stl", tolerance=0.0001)  # Higher resolution
export_step(obj, "part.step")                  # CAD interchange (lossless)
export_gltf(obj, "part.glb")                   # Web viewers
```

| Function | Parameters | Description |
|----------|------------|-------------|
| `export_stl` | `obj, filename, tolerance=0.001, angular_tolerance=0.1` | Tessellated mesh |
| `export_step` | `obj, filename` | Exact geometry |
| `export_gltf` | `obj, filename` | Web-ready format |

All return `Path` to exported file.

### How It Works

1. **Tessellate**: build123d → triangle meshes (ocp-tessellate)
2. **Transport**: Mesh data → JavaScript (anywidget)
3. **Render**: Three.js via three-cad-viewer
4. **Update**: `render()` updates geometry, camera preserved

## License

MIT
