"""Tests for CAD viewer widget."""

from build123d import Box, Cylinder


class TestView:
    """Tests for view() function."""

    def test_create_empty_viewer(self):
        """Create a viewer with no shapes."""
        from marimo_cad import view

        v = view()

        assert v.width == "100%"  # Default CSS width
        assert v.height == 600
        assert v.shapes_data == {}

    def test_custom_dimensions_kwargs(self):
        """Create a viewer with custom dimensions via kwargs."""
        from marimo_cad import view

        v = view(width=1200, height=800)

        assert v.width == "1200px"  # Int converted to px string
        assert v.height == 800

    def test_custom_dimensions_dict(self):
        """Create a viewer with custom dimensions via options dict."""
        from marimo_cad import view

        v = view({"width": 1200, "height": 800})

        assert v.width == "1200px"  # Int converted to px string
        assert v.height == 800

    def test_css_width_string(self):
        """Create a viewer with CSS width string."""
        from marimo_cad import view

        v = view(width="50%", height=400)

        assert v.width == "50%"  # CSS string passed through
        assert v.height == 400

    def test_single_shape(self):
        """Create viewer with single shape."""
        from marimo_cad import view

        box = Box(10, 10, 10)
        v = view(box)

        assert v.shapes_data
        assert len(v.shapes_data.get("parts", [])) == 1

    def test_shapes_with_options(self):
        """Create viewer with shapes and options."""
        from marimo_cad import view

        box = Box(10, 10, 10)
        v = view([box], {"width": 900, "height": 600})

        assert v.width == "900px"  # Int converted to px string
        assert v.height == 600
        assert v.shapes_data

    def test_multiple_shapes(self):
        """Create viewer with multiple shapes."""
        from marimo_cad import view

        box = Box(10, 10, 10)
        cyl = Cylinder(3, 15)
        v = view([box, cyl])

        assert len(v.shapes_data.get("parts", [])) == 2

    def test_part_spec(self):
        """Create viewer with PartSpec dict."""
        from marimo_cad import view

        box = Box(10, 10, 10)
        v = view({"shape": box, "name": "MyBox", "color": "blue"})

        assert len(v.shapes_data.get("parts", [])) == 1

    def test_mixed_list(self):
        """Create viewer with mixed list of shapes and PartSpecs."""
        from marimo_cad import view

        box = Box(10, 10, 10)
        cyl = Cylinder(3, 15)
        v = view(
            [
                {"shape": box, "name": "Base", "color": "blue"},
                cyl,
            ]
        )

        assert len(v.shapes_data.get("parts", [])) == 2

    def test_repr(self):
        """Test string representation."""
        from marimo_cad import view

        box = Box(10, 10, 10)
        v = view([box, box], {"width": 900, "height": 600})

        assert "CADViewer" in repr(v)
        assert "2 parts" in repr(v)
        assert "900px" in repr(v)
        assert "600" in repr(v)

    def test_generator(self):
        """Create viewer with shapes from generator."""
        from marimo_cad import view

        def make_boxes():
            for i in range(3):
                yield Box(5 + i, 5 + i, 5 + i)

        v = view(list(make_boxes()))

        assert len(v.shapes_data.get("parts", [])) == 3


class TestRender:
    """Tests for render() method."""

    def test_render_replaces_shapes(self):
        """render() replaces existing shapes."""
        from marimo_cad import view

        box = Box(10, 10, 10)
        cyl = Cylinder(5, 20)

        v = view()
        v.render(box)
        assert len(v.shapes_data.get("parts", [])) == 1

        v.render([box, cyl])
        assert len(v.shapes_data.get("parts", [])) == 2

        v.render(cyl)
        assert len(v.shapes_data.get("parts", [])) == 1

    def test_render_empty_clears(self):
        """render([]) clears shapes."""
        from marimo_cad import view

        box = Box(10, 10, 10)
        v = view(box)
        assert len(v.shapes_data.get("parts", [])) == 1

        v.render([])
        assert len(v.shapes_data.get("parts", [])) == 0


class TestColorResolution:
    """Tests for color resolution."""

    def test_named_colors(self):
        """Named colors are resolved to hex."""
        from marimo_cad.widget import _resolve_color

        assert _resolve_color("blue") == "#4a90d9"
        assert _resolve_color("red") == "#e85454"
        assert _resolve_color("GREEN") == "#50e850"  # case insensitive

    def test_hex_colors_passthrough(self):
        """Hex colors pass through unchanged."""
        from marimo_cad.widget import _resolve_color

        assert _resolve_color("#ff0000") == "#ff0000"
        assert _resolve_color("#ABC123") == "#ABC123"

    def test_none_color(self):
        """None color returns None."""
        from marimo_cad.widget import _resolve_color

        assert _resolve_color(None) is None
