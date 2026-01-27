"""marimo-cad demo - Parametric CAD (build123d) for marimo."""

import marimo

__generated_with = "0.19.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    from build123d import Box, Cylinder, Pos

    import marimo_cad as cad

    return Box, Cylinder, Pos, cad, mo


@app.cell
def _(mo):
    mo.md("""
    # marimo-cad demo

    **Parametric CAD (build123d) for marimo**

    Simple API:
    - `mo.ui.anywidget(cad.view())` - create a reactive viewer
    - `viewer.widget.render(shapes)` - render shapes
    """)
    return


@app.cell
def _(mo):
    mo.md("## 1. Basic Usage")
    return


@app.cell
def _(Box, cad):
    # Simple non-reactive example
    basic_view = cad.view()
    basic_view.render(Box(20, 20, 20))
    basic_view
    return


@app.cell
def _(mo):
    mo.md("## 2. Parametric Box")
    return


@app.cell
def _(mo):
    width = mo.ui.slider(10, 50, value=30, label="Width")
    height = mo.ui.slider(10, 50, value=20, label="Height")
    depth = mo.ui.slider(10, 50, value=15, label="Depth")
    mo.hstack([width, height, depth])
    return depth, height, width


@app.cell
def _(cad, mo):
    # Wrap with mo.ui.anywidget for reactivity
    box_view = mo.ui.anywidget(cad.view())
    return (box_view,)


@app.cell
def _(box_view):
    box_view
    return


@app.cell
def _(Box, box_view, depth, height, width):
    # Update when sliders change - access underlying widget
    box_view.widget.render(Box(width.value, height.value, depth.value))
    return


@app.cell
def _(mo):
    mo.md("## 3. Multiple Parts with Colors")
    return


@app.cell
def _(Box, Cylinder, Pos, cad):
    # Non-reactive - all in one cell
    multi_view = cad.view()
    _box = Box(30, 30, 10)
    _cylinder = Pos(0, 0, 15) * Cylinder(8, 20)
    multi_view.render(
        [
            {"shape": _box, "name": "Base", "color": "blue"},
            {"shape": _cylinder, "name": "Pillar", "color": "red"},
        ]
    )
    multi_view
    return


@app.cell
def _(mo):
    mo.md("## 4. Dynamic Assembly")
    return


@app.cell
def _(mo):
    pillar_count = mo.ui.slider(1, 6, value=4, label="Number of Pillars")
    pillar_count
    return (pillar_count,)


@app.cell
def _(cad, mo):
    # Wrap with mo.ui.anywidget for reactivity
    assembly_view = mo.ui.anywidget(cad.view())
    return (assembly_view,)


@app.cell
def _(assembly_view):
    assembly_view
    return


@app.cell
def _(Box, Cylinder, Pos, assembly_view, pillar_count):
    import math

    _parts = []

    # Base
    _base = Box(60, 60, 5)
    _parts.append({"shape": _base, "name": "Base", "color": "gray"})

    # Pillars in a circle
    _n = pillar_count.value
    _radius = 20
    for _i in range(_n):
        _angle = 2 * math.pi * _i / _n
        _x = _radius * math.cos(_angle)
        _y = _radius * math.sin(_angle)
        _pillar = Pos(_x, _y, 15) * Cylinder(3, 25)
        _parts.append({"shape": _pillar, "name": f"Pillar {_i + 1}", "color": "orange"})

    # Top
    _top = Pos(0, 0, 30) * Box(50, 50, 3)
    _parts.append({"shape": _top, "name": "Top", "color": "blue"})

    # Access underlying widget to render
    assembly_view.widget.render(_parts)
    return


if __name__ == "__main__":
    app.run()
