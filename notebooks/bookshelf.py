"""Parametric Bookshelf - marimo-cad example."""

import marimo

__generated_with = "0.19.6"
app = marimo.App(width="medium")


@app.cell
def _():
    import marimo as mo
    from build123d import Box, Pos

    import marimo_cad as cad

    return Box, Pos, cad, mo


@app.cell
def _(mo):
    mo.md("""
    # Parametric Bookshelf
    """)
    return


@app.cell
def _(Box, Pos, cad, mo):
    # Fixed dimensions (cm)
    width = 80
    depth = 30
    side_t = 2  # side panel thickness
    shelf_t = 2  # shelf thickness
    back_t = 1  # back panel thickness

    # Colors
    side_color = "#8B4513"  # saddle brown
    shelf_color = "#DEB887"  # burlywood
    back_color = "#A0522D"  # sienna

    # Create viewer
    viewer = mo.ui.anywidget(cad.view())

    def build_bookshelf(shelf_count: int, height: int) -> list:
        """Build bookshelf parts from parameters."""
        parts = []

        # Internal dimensions
        inner_width = width - 2 * side_t
        inner_height = height - 2 * shelf_t

        # Left side
        left = Pos(-width / 2 + side_t / 2, 0, height / 2) * Box(side_t, depth, height)
        parts.append({"shape": left, "name": "Left Side", "color": side_color})

        # Right side
        right = Pos(width / 2 - side_t / 2, 0, height / 2) * Box(side_t, depth, height)
        parts.append({"shape": right, "name": "Right Side", "color": side_color})

        # Back panel
        back = Pos(0, -depth / 2 + back_t / 2, height / 2) * Box(inner_width, back_t, height)
        parts.append({"shape": back, "name": "Back", "color": back_color})

        # Top panel (lid)
        top = Pos(0, 0, height - shelf_t / 2) * Box(inner_width, depth, shelf_t)
        parts.append({"shape": top, "name": "Top", "color": side_color})

        # Bottom shelf
        bottom = Pos(0, 0, shelf_t / 2) * Box(inner_width, depth, shelf_t)
        parts.append({"shape": bottom, "name": "Bottom", "color": shelf_color})

        # Internal shelves (evenly spaced between bottom and top)
        if shelf_count > 2:
            # Spacing between shelf centers
            # Bottom center at shelf_t/2, Top center at height - shelf_t/2
            # Total span: height - shelf_t, divided into (shelf_count - 1) gaps
            spacing = (height - shelf_t) / (shelf_count - 1)
            for i in range(1, shelf_count - 1):
                z = shelf_t / 2 + i * spacing
                shelf = Pos(0, 0, z) * Box(inner_width, depth, shelf_t)
                parts.append({"shape": shelf, "name": f"Shelf {i}", "color": shelf_color})

        return parts

    def update_viewer(_):
        """Update viewer when sliders change."""
        parts = build_bookshelf(shelf_slider.value, height_slider.value)
        viewer.widget.render(parts)

    # Sliders
    shelf_slider = mo.ui.slider(2, 8, value=4, label="Shelves", on_change=update_viewer)
    height_slider = mo.ui.slider(60, 200, value=120, label="Height (cm)", on_change=update_viewer)
    return build_bookshelf, height_slider, shelf_slider, viewer


@app.cell
def _(build_bookshelf, height_slider, mo, shelf_slider, viewer):
    # Initial render
    _parts = build_bookshelf(shelf_slider.value, height_slider.value)
    viewer.widget.render(_parts)

    # Display
    mo.vstack([mo.hstack([shelf_slider, height_slider]), viewer])
    return


if __name__ == "__main__":
    app.run()
