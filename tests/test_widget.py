"""Tests for CAD viewer widget."""

from build123d import Box, Cylinder


class TestViewer:
    """Tests for Viewer class."""

    def test_create_empty_viewer(self):
        """Create a viewer with no shapes."""
        from marimo_cad import Viewer

        v = Viewer()
        widget = v._wrapped.widget

        assert widget.width == "100%"
        assert widget.height == 600
        assert widget.shapes_data == {}

    def test_custom_dimensions_kwargs(self):
        """Create a viewer with custom dimensions via kwargs."""
        from marimo_cad import Viewer

        v = Viewer(width=1200, height=800)
        widget = v._wrapped.widget

        assert widget.width == "1200px"
        assert widget.height == 800

    def test_css_width_string(self):
        """Create a viewer with CSS width string."""
        from marimo_cad import Viewer

        v = Viewer(width="50%", height=400)
        widget = v._wrapped.widget

        assert widget.width == "50%"
        assert widget.height == 400

    def test_render_single_shape(self):
        """Render a single shape."""
        from marimo_cad import Viewer

        box = Box(10, 10, 10)
        v = Viewer()
        v.render(box)

        assert v._wrapped.widget.shapes_data
        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 1

    def test_render_multiple_shapes(self):
        """Render multiple shapes."""
        from marimo_cad import Viewer

        box = Box(10, 10, 10)
        cyl = Cylinder(3, 15)
        v = Viewer()
        v.render([box, cyl])

        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 2

    def test_render_part_spec(self):
        """Render with PartSpec dict."""
        from marimo_cad import Viewer

        box = Box(10, 10, 10)
        v = Viewer()
        v.render({"shape": box, "name": "MyBox", "color": "blue"})

        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 1

    def test_render_mixed_list(self):
        """Render mixed list of shapes and PartSpecs."""
        from marimo_cad import Viewer

        box = Box(10, 10, 10)
        cyl = Cylinder(3, 15)
        v = Viewer()
        v.render(
            [
                {"shape": box, "name": "Base", "color": "blue"},
                cyl,
            ]
        )

        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 2

    def test_render_replaces_shapes(self):
        """render() replaces existing shapes."""
        from marimo_cad import Viewer

        box = Box(10, 10, 10)
        cyl = Cylinder(5, 20)

        v = Viewer()
        v.render(box)
        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 1

        v.render([box, cyl])
        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 2

        v.render(cyl)
        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 1

    def test_render_empty_clears(self):
        """render([]) clears shapes."""
        from marimo_cad import Viewer

        box = Box(10, 10, 10)
        v = Viewer()
        v.render(box)
        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 1

        v.render([])
        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 0

    def test_repr(self):
        """Test string representation."""
        from marimo_cad import Viewer

        box = Box(10, 10, 10)
        v = Viewer()
        v.render([box, box])

        assert "Viewer" in repr(v)
        assert "2 parts" in repr(v)

    def test_generator(self):
        """Render shapes from generator."""
        from marimo_cad import Viewer

        def make_boxes():
            for i in range(3):
                yield Box(5 + i, 5 + i, 5 + i)

        v = Viewer()
        v.render(list(make_boxes()))

        assert len(v._wrapped.widget.shapes_data.get("parts", [])) == 3


class TestColorResolution:
    """Tests for color resolution."""

    def test_named_colors(self):
        """Named colors are resolved to hex."""
        from marimo_cad.utils import resolve_color

        assert resolve_color("blue") == "#4a90d9"
        assert resolve_color("red") == "#e85454"
        assert resolve_color("GREEN") == "#50e850"

    def test_hex_colors_passthrough(self):
        """Hex colors pass through unchanged."""
        from marimo_cad.utils import resolve_color

        assert resolve_color("#ff0000") == "#ff0000"
        assert resolve_color("#ABC123") == "#ABC123"

    def test_none_color(self):
        """None color returns None."""
        from marimo_cad.utils import resolve_color

        assert resolve_color(None) is None
