"""Tests for tessellation module."""

import pytest
from build123d import Box, Compound, Cylinder


class TestToViewerFormat:
    """Tests for to_viewer_format function."""

    def test_single_box(self):
        """Tessellate a simple box and verify output structure."""
        from marimo_cad.tessellate import to_viewer_format

        box = Box(10, 10, 10)
        result = to_viewer_format(box)

        # Check top-level structure
        assert "version" in result
        assert "parts" in result
        assert "loc" in result
        assert "name" in result
        assert "id" in result
        assert "bb" in result

        # Should have one part
        assert len(result["parts"]) == 1

        part = result["parts"][0]
        assert "shape" in part
        assert "vertices" in part["shape"]
        assert "triangles" in part["shape"]
        assert "normals" in part["shape"]

        # Box should have vertices and triangles
        assert len(part["shape"]["vertices"]) > 0
        assert len(part["shape"]["triangles"]) > 0

    def test_box_with_name_and_color(self):
        """Tessellate a box with custom name and color."""
        from marimo_cad.tessellate import to_viewer_format

        box = Box(5, 5, 5)
        result = to_viewer_format(box, names=["MyBox"], colors=["#ff0000"])

        assert len(result["parts"]) == 1
        part = result["parts"][0]

        assert part["name"] == "MyBox"
        assert part["color"] == "#ff0000"

    def test_multiple_objects(self):
        """Tessellate multiple objects."""
        from marimo_cad.tessellate import to_viewer_format

        box = Box(10, 10, 10)
        cyl = Cylinder(3, 15)

        result = to_viewer_format(
            box,
            cyl,
            names=["Box", "Cylinder"],
            colors=["#0000ff", "#00ff00"],
        )

        assert len(result["parts"]) == 2
        assert result["parts"][0]["name"] == "Box"
        assert result["parts"][1]["name"] == "Cylinder"

    def test_empty_input(self):
        """Tessellate with no objects returns empty structure."""
        from marimo_cad.tessellate import to_viewer_format

        result = to_viewer_format()

        assert result["parts"] == []
        assert result["name"] == "Empty"

    def test_bounding_box(self):
        """Verify bounding box is calculated correctly."""
        from marimo_cad.tessellate import to_viewer_format

        box = Box(20, 10, 5)
        result = to_viewer_format(box)

        bb = result["bb"]
        # Box centered at origin: extends from -size/2 to +size/2
        assert bb["xmin"] == pytest.approx(-10, abs=0.1)
        assert bb["xmax"] == pytest.approx(10, abs=0.1)
        assert bb["ymin"] == pytest.approx(-5, abs=0.1)
        assert bb["ymax"] == pytest.approx(5, abs=0.1)
        assert bb["zmin"] == pytest.approx(-2.5, abs=0.1)
        assert bb["zmax"] == pytest.approx(2.5, abs=0.1)

    def test_csg_operation(self):
        """Tessellate result of CSG operation (box - cylinder)."""
        from marimo_cad.tessellate import to_viewer_format

        box = Box(10, 10, 10)
        hole = Cylinder(3, 15)
        result_shape = box - hole

        result = to_viewer_format(result_shape, names=["BoxWithHole"])

        assert len(result["parts"]) == 1
        part = result["parts"][0]

        # CSG result should have more triangles than a simple box
        # because of the hole
        assert len(part["shape"]["triangles"]) > 36  # simple box has 36

    def test_alpha_value(self):
        """Test alpha (transparency) value is passed through."""
        from marimo_cad.tessellate import to_viewer_format

        box = Box(5, 5, 5)
        result = to_viewer_format(box, alphas=[0.5])

        part = result["parts"][0]
        assert part["alpha"] == 0.5


class TestTessellateSingle:
    """Tests for tessellate_single function."""

    def test_single_part(self):
        """Tessellate a single part."""
        from marimo_cad.tessellate import tessellate_single

        box = Box(10, 10, 10)
        part = tessellate_single(box, name="TestBox", color="#ff0000")

        assert part["name"] == "TestBox"
        assert part["color"] == "#ff0000"
        assert "shape" in part
        assert len(part["shape"]["vertices"]) > 0

    def test_with_alpha(self):
        """Test alpha value."""
        from marimo_cad.tessellate import tessellate_single

        box = Box(5, 5, 5)
        part = tessellate_single(box, alpha=0.7)

        assert part["alpha"] == 0.7


class TestCombineParts:
    """Tests for combine_parts function."""

    def test_combine_multiple_parts(self):
        """Combine multiple tessellated parts."""
        from marimo_cad.tessellate import combine_parts, tessellate_single

        box = Box(10, 10, 10)
        cyl = Cylinder(3, 15)

        part1 = tessellate_single(box, name="Box", color="#0000ff")
        part2 = tessellate_single(cyl, name="Cylinder", color="#00ff00")

        result = combine_parts([part1, part2], name="Assembly")

        assert result["name"] == "Assembly"
        assert len(result["parts"]) == 2
        assert result["parts"][0]["name"] == "Box"
        assert result["parts"][1]["name"] == "Cylinder"

    def test_empty_parts_list(self):
        """Combining empty list returns empty structure."""
        from marimo_cad.tessellate import combine_parts

        result = combine_parts([])

        assert result["parts"] == []
        assert result["name"] == "Empty"

    def test_combined_bounding_box(self):
        """Bounding box should be calculated from parts."""
        from marimo_cad.tessellate import combine_parts, tessellate_single

        box1 = Box(10, 10, 10)
        box2 = Box(20, 20, 20)

        part1 = tessellate_single(box1, name="Small")
        part2 = tessellate_single(box2, name="Large")

        result = combine_parts([part1, part2])

        bb = result["bb"]
        # Combined bbox should be the union (largest box dominates)
        assert bb["xmax"] == pytest.approx(10, abs=0.5)  # 20/2
        assert bb["ymax"] == pytest.approx(10, abs=0.5)
        assert bb["zmax"] == pytest.approx(10, abs=0.5)


class TestNestedCompound:
    """Tests for nested Compound(children=[...]) assemblies (issue #6)."""

    def test_single_level_children(self):
        """Single-level Compound with children renders."""
        from marimo_cad.tessellate import to_viewer_format

        obj = Compound(label="Top", children=[Box(10, 10, 10)])
        result = to_viewer_format(obj)

        assert len(result["parts"]) == 1
        assert len(result["parts"][0]["shape"]["vertices"]) > 0

    def test_nested_children_compound(self):
        """Nested Compound built with children= renders (was blank)."""
        from marimo_cad.tessellate import to_viewer_format

        obj = Compound(
            label="Top",
            children=[Compound(label="Inner", children=[Box(10, 10, 10)])],
        )
        result = to_viewer_format(obj)

        assert len(result["parts"]) == 1
        part = result["parts"][0]
        assert len(part["shape"]["vertices"]) > 0
        assert len(part["shape"]["triangles"]) > 0
        bb = result["bb"]
        assert bb["xmax"] - bb["xmin"] == pytest.approx(10, abs=0.5)

    def test_deeply_nested_unique_names(self):
        """Two identical leaf names flatten without collision."""
        from marimo_cad.tessellate import to_viewer_format

        obj = Compound(
            label="Top",
            children=[
                Compound(label="A", children=[Box(10, 10, 10)]),
                Compound(label="B", children=[Box(5, 5, 5)]),
            ],
        )
        result = to_viewer_format(obj)

        assert len(result["parts"]) == 2
        names = [p["name"] for p in result["parts"]]
        assert len(set(names)) == 2
        for part in result["parts"]:
            assert len(part["shape"]["vertices"]) > 0


class TestMergeHelpers:
    """Unit tests for the state-merge helpers (no CAD objects needed)."""

    def test_flatten_nested_groups(self):
        """Nested groups flatten to leaf parts."""
        from marimo_cad.tessellate import _merge_shapes_into_states

        shapes = [{"vertices": [1.0], "triangles": [0]}]
        states = {
            "parts": [
                {
                    "name": "Inner",
                    "id": "/Top/Inner",
                    "parts": [
                        {
                            "id": "/Top/Inner/Solid",
                            "type": "shapes",
                            "name": "Solid",
                            "shape": {"ref": 0},
                        }
                    ],
                }
            ],
            "name": "Top",
            "id": "/Top",
        }
        result = _merge_shapes_into_states(shapes, states)

        assert len(result["parts"]) == 1
        assert result["parts"][0]["name"] == "Solid"
        assert result["parts"][0]["shape"]["vertices"] == [1.0]

    def test_invalid_ref_dropped(self):
        """Parts with missing refs are dropped instead of blank."""
        from marimo_cad.tessellate import _merge_shapes_into_states

        states = {
            "parts": [
                {
                    "id": "/Top/Bad",
                    "type": "shapes",
                    "name": "Bad",
                    "shape": {"ref": 5},
                }
            ],
            "name": "Top",
            "id": "/Top",
        }
        result = _merge_shapes_into_states([], states)

        assert result["parts"] == []
