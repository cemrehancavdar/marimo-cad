# JS Architecture: three-cad-viewer Wrapper

## Overview

This document explains the JavaScript wrapper layer we built over `three-cad-viewer` to enable reactive CAD visualization in marimo notebooks.

## The Problem

`three-cad-viewer` is a powerful CAD viewer, but it has several quirks that make reactive updates difficult:

1. **Full re-render resets camera** - Calling `viewer.render()` rebuilds everything and resets camera position
2. **Internal API confusion** - `ObjectGroup` extends `THREE.Group` directly, so position/quaternion are on the group itself (not `group.group`)
3. **Path-based group keys** - Parts are stored with paths like `/shapes/assembly/Left` not just `Left`
4. **Tree view coupling** - The tree UI is built during render and doesn't update when parts change
5. **No exported TreeView** - The `TreeView` class is internal, making tree updates tricky

## Solution Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     index.js (Widget)                        │
│  - Creates Display and LiveViewer                           │
│  - Handles model.on('change:shapes_data') events            │
│  - Calls viewer.syncParts() for updates                     │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                 LiveViewer (extends Viewer)                  │
│  - render() - initial render, builds PartManager            │
│  - syncParts() - smart update (add/remove/update parts)     │
│  - _rebuildTreeView() - updates tree when parts change      │
│  - Exposes parts: PartManager for direct manipulation       │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      PartManager                             │
│  - get(id) → PartHandle                                     │
│  - add(partData) → PartHandle                               │
│  - remove(id)                                               │
│  - update(id, partData)                                     │
│  - sync(partsArray) → { added, updated, removed }           │
│  - buildFromViewer() - maps viewer's groups to handles      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                       PartHandle                             │
│  - setPosition(x, y, z)                                     │
│  - setQuaternion(x, y, z, w)                                │
│  - setTransform(loc) - from [[pos], [quat]] format          │
│  - updateGeometry(vertices, normals, triangles)             │
│  - updateEdges(edgeData)                                    │
│  - dispose()                                                │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              three-cad-viewer (external library)             │
│  - Viewer: base viewer class                                │
│  - Display: UI container (tree, toolbar, canvas)            │
│  - THREE.js scene management                                │
└─────────────────────────────────────────────────────────────┘
```

## Key Files

### `js/src/part-manager.js`

**PartHandle** - Clean interface to a single part:
- Abstracts away three-cad-viewer's ObjectGroup quirks
- Provides simple `setPosition()`, `updateGeometry()` methods
- Handles buffer reuse for efficient geometry updates

**PartManager** - Manages all parts:
- Tracks parts by ID with a Map
- `sync()` method does intelligent diffing: only adds new, removes old, updates existing
- `buildFromViewer()` maps three-cad-viewer's internal groups to PartHandles
- Handles path-based key lookup (finds `Left` in `/shapes/assembly/Left`)

### `js/src/live-viewer.js`

**LiveViewer** - Extends `three-cad-viewer.Viewer`:
- Overrides `render()` to initialize PartManager after scene builds
- `syncParts()` - main update method, preserves camera
- `_rebuildTreeView()` - reconstructs tree UI when parts change
- `_buildTreeFromParts()` - creates tree data structure from parts array

### `js/src/index.js`

**Widget entry point**:
- Creates Display and LiveViewer
- Listens for `change:shapes_data` traitlet events
- First render uses `viewer.render()`, subsequent updates use `viewer.syncParts()`

## How It Works

### Initial Render
```javascript
// First time - full render
viewer.render(shapesData, renderOptions, viewerOptions);
// This:
// 1. Builds THREE.js scene with all parts
// 2. Creates tree view
// 3. Sets up camera, lights, controls
// 4. PartManager.buildFromViewer() maps groups to handles
```

### Subsequent Updates
```javascript
// When slider changes - smart sync
viewer.syncParts(newShapesData);
// This:
// 1. PartManager.sync() diffs old vs new parts
// 2. Removes parts not in new data
// 3. Updates existing parts (geometry + transform)
// 4. Adds new parts
// 5. If parts added/removed, rebuilds tree view
// 6. Camera position preserved!
```

### Tree View Rebuild
```javascript
// When parts added or removed
_rebuildTreeView(partsData) {
  // 1. Build tree structure: { shapes: { "PartName": [1,1], ... } }
  const newTree = this._buildTreeFromParts(partsData);
  
  // 2. Update viewer's internal tree properties
  this.tree = this.expandedTree = this.compactTree = newTree;
  
  // 3. Get TreeView class from existing instance (not exported)
  const TreeViewClass = this.treeview.constructor;
  
  // 4. Dispose old, create new
  this.treeview.dispose();
  this.treeview = new TreeViewClass(this.tree, ...callbacks);
  
  // 5. Render new tree
  this.display.clearCadTree();
  this.display.addCadTree(this.treeview.create());
  this.treeview.render();
}
```

## three-cad-viewer Quirks Handled

### ObjectGroup is a THREE.Group
```javascript
// WRONG - group.group is undefined
group.group.position.set(x, y, z);

// CORRECT - ObjectGroup extends THREE.Group
group.position.set(x, y, z);
```

### Path-based Keys
```javascript
// Groups are stored with paths
const groups = viewer.nestedGroup.groups;
// Keys: "/shapes/assembly/Left", "/shapes/assembly/Right", etc.

// PartManager handles lookup
_findViewerGroup(id) {
  for (const [path, group] of Object.entries(groups)) {
    if (path === id || path.endsWith('/' + id)) {
      return { path, group };
    }
  }
}
```

### Tree Structure Format
```javascript
// three-cad-viewer expects this format:
{
  "shapes": {
    "Left Side": [1, 1],   // [shape_visible, edges_visible]
    "Right Side": [1, 1],
    "Top": [1, 1],
    // ...
  }
}
```

## Usage Example

```javascript
// In marimo widget
const viewer = new LiveViewer(display, options, callback);

// Initial render
viewer.render(shapesData, renderOptions, viewerOptions);

// When data changes (slider moved)
model.on("change:shapes_data", () => {
  const newData = model.get("shapes_data");
  viewer.syncParts(newData);  // Camera preserved, tree updated
});

// Direct part manipulation (if needed)
const part = viewer.getPart("Left Side");
part.setPosition(10, 0, 0);
viewer.update(true);
```

## Benefits

1. **Clean API** - No need to understand three-cad-viewer internals
2. **Reactive updates** - `syncParts()` handles add/remove/update intelligently
3. **Camera preserved** - No jarring resets when parameters change
4. **Tree updates** - Tree view reflects current parts
5. **Efficient** - Reuses geometry buffers when sizes match
