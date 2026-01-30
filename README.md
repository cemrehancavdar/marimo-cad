# marimo-cad

**Reactive Parametric CAD** for [marimo](https://marimo.io) notebooks.

Build interactive 3D CAD models with sliders that update in real-time without losing your camera position.

![Parametric Bookshelf Demo](assets/demo.gif)

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
from build123d import Box
import marimo_cad as cad

# Create slider
size = mo.ui.slider(10, 50, value=20, label="Size")

# Create viewer once
viewer = cad.Viewer()

# Build and render - camera stays put when slider changes!
box = Box(size.value, size.value, size.value)
viewer.render(box)

mo.vstack([size, viewer])
```

---

## API Reference

### `Viewer`

The main class for displaying 3D CAD models.

```python
import marimo_cad as cad

viewer = cad.Viewer(width="100%", height=600)
```

#### Constructor

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `width` | `str \| int` | `"100%"` | CSS width (`"100%"`, `"800px"`) or pixels as int |
| `height` | `int` | `600` | Height in pixels |

#### Methods

##### `render(shapes)`

Render shapes to the viewer. Camera position is preserved across calls.

```python
viewer.render(shapes)
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `shapes` | `Shape \| PartSpec \| Sequence` | Single shape, dict, or list of shapes/dicts |

**Examples:**

```python
# Single shape
viewer.render(box)

# Multiple shapes (auto-named Part 1, Part 2, ...)
viewer.render([box, cylinder])

# Named parts with colors
viewer.render([
    {"shape": base, "name": "Base", "color": "blue"},
    {"shape": top, "name": "Top", "color": "red", "alpha": 0.8},
])
```

---

### `PartSpec`

A TypedDict for specifying parts with metadata. Used with `viewer.render()`.

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `shape` | `Shape` | Yes | Any build123d object (Box, Cylinder, Part, etc.) |
| `name` | `str` | No | Display name in tree view |
| `color` | `str` | No | Color name or hex code |
| `alpha` | `float` | No | Opacity from 0.0 (transparent) to 1.0 (opaque) |

```python
part: cad.PartSpec = {
    "shape": Box(10, 10, 10),
    "name": "My Box",
    "color": "blue",
    "alpha": 0.9,
}
```

---

### `COLORS`

Dictionary of named colors available for parts.

```python
from marimo_cad import COLORS

print(COLORS)
# {
#     "blue": "#4a90d9",
#     "red": "#e85454",
#     "green": "#50e850",
#     "yellow": "#e8b024",
#     "orange": "#e87824",
#     "purple": "#b024e8",
#     "cyan": "#24e8b0",
#     "pink": "#e824b0",
#     "gray": "#888888",
#     "white": "#ffffff",
#     "black": "#333333",
# }
```

You can use color names directly in `PartSpec`:

```python
{"shape": box, "color": "blue"}      # Named color
{"shape": box, "color": "#ff6600"}   # Hex color
```

---

### Export Functions

#### `export_stl(obj, filename, tolerance=0.001, angular_tolerance=0.1)`

Export to STL format (for 3D printing).

```python
from marimo_cad import export_stl

export_stl(box, "part.stl")
export_stl(box, "fine.stl", tolerance=0.0001)  # Higher resolution
```

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `obj` | `Shape` | — | build123d object to export |
| `filename` | `str \| Path` | — | Output file path |
| `tolerance` | `float` | `0.001` | Linear tolerance (lower = finer mesh) |
| `angular_tolerance` | `float` | `0.1` | Angular tolerance in radians |

**Returns:** `Path` to the exported file

---

#### `export_step(obj, filename)`

Export to STEP format (for CAD interchange).

```python
from marimo_cad import export_step

export_step(box, "part.step")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `obj` | `Shape` | build123d object to export |
| `filename` | `str \| Path` | Output file path |

**Returns:** `Path` to the exported file

STEP is a lossless format that preserves exact geometry. Use for sharing with other CAD software.

---

#### `export_gltf(obj, filename)`

Export to GLTF/GLB format (for web viewers).

```python
from marimo_cad import export_gltf

export_gltf(box, "part.glb")
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `obj` | `Shape` | build123d object to export |
| `filename` | `str \| Path` | Output file path (.glb or .gltf) |

**Returns:** `Path` to the exported file

---

## Viewer Features

The 3D viewer (powered by [three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer)) includes:

- **Mouse controls**: Rotate (drag), pan (right-drag), zoom (scroll)
- **Tree view**: Toggle part visibility, see part hierarchy
- **Clipping planes**: Slice the model along X/Y/Z axes
- **Explode view**: Separate parts for inspection
- **Measurement tools**: Distance and angle measurements

---

## Examples

### Parametric Bookshelf

```python
import marimo as mo
from build123d import Box, Pos
import marimo_cad as cad

shelf_count = mo.ui.slider(2, 8, value=4, label="Shelves")
viewer = cad.Viewer()

def build_bookshelf(n_shelves, height=120, width=80, depth=30):
    parts = []
    # Left/right sides
    parts.append({"shape": Pos(-width/2, 0, height/2) * Box(2, depth, height), "name": "Left", "color": "orange"})
    parts.append({"shape": Pos(width/2, 0, height/2) * Box(2, depth, height), "name": "Right", "color": "orange"})
    # Shelves
    spacing = height / (n_shelves - 1)
    for i in range(n_shelves):
        z = i * spacing
        parts.append({"shape": Pos(0, 0, z) * Box(width-4, depth, 2), "name": f"Shelf {i+1}", "color": "yellow"})
    return parts

viewer.render(build_bookshelf(shelf_count.value))
mo.vstack([shelf_count, viewer])
```

### Export with Download Button

```python
import tempfile
from pathlib import Path
import marimo as mo
from build123d import Box
import marimo_cad as cad
from marimo_cad import export_stl

box = Box(20, 20, 20)
viewer = cad.Viewer()
viewer.render(box)

def get_stl():
    with tempfile.TemporaryDirectory() as tmp:
        path = Path(tmp) / "box.stl"
        export_stl(box, path)
        return path.read_bytes()

download = mo.download(data=get_stl, filename="box.stl", label="Download STL")
mo.vstack([viewer, download])
```

---

## How It Works

1. **Tessellation**: build123d shapes are converted to triangle meshes via [ocp-tessellate](https://github.com/bernhard-42/ocp-tessellate)
2. **Transport**: Mesh data is sent to JavaScript via [anywidget](https://anywidget.dev/) traitlets
3. **Rendering**: [three-cad-viewer](https://github.com/bernhard-42/three-cad-viewer) renders meshes with Three.js
4. **Updates**: When `render()` is called again, only geometry changes—camera state is preserved

---

## Limitations

- **Large models**: Very complex models (>100k triangles) may be slow to tessellate
- **Assemblies**: Currently no support for build123d Assembly objects (use list of PartSpecs instead)
- **Animations**: No animation support
- **Part selection**: Selection events are captured but not yet exposed to Python

---

## Running Examples

```bash
git clone https://github.com/cemrehancavdar/marimo-cad
cd marimo-cad && uv sync && cd js && npm install && npm run build && cd ..

uv run marimo edit notebooks/vase.py      # Parametric vase with STL export
uv run marimo edit notebooks/bookshelf.py # Parametric bookshelf
uv run marimo edit notebooks/demo.py      # Basic examples
```

## Development

```bash
uv run pytest tests/                       # Run tests (34 tests)
uv run ruff check src/ notebooks/ --fix    # Lint
cd js && npm run build                     # Rebuild JS after changes
npm run test:e2e                           # Run Playwright e2e tests
```

## License

MIT
