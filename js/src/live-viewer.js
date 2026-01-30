/**
 * LiveViewer - Extended three-cad-viewer with live geometry updates
 * 
 * Provides reactive part management via:
 * - PartManager: Add/remove/update parts with real ObjectGroup instances
 * - StateManager: Persist visibility states across tree rebuilds
 * - ClippingExtension: Clipping support for dynamically added parts
 * 
 * Camera position preserved across updates.
 */

import { Viewer } from "three-cad-viewer";
import { PartManager } from "./part-manager.js";
import { StateManager } from "./state-manager.js";
import { COLLAPSE_MODE } from "./constants.js";

/**
 * Extended Viewer with live geometry updates and stateful part management.
 * 
 * Usage:
 *   const viewer = new LiveViewer(display, options, callback);
 *   viewer.render(shapesData, renderOptions, viewerOptions);  // Initial render
 *   viewer.syncParts(newShapesData);  // Update parts (camera preserved)
 */
export class LiveViewer extends Viewer {
  constructor(display, options, notifyCallback) {
    super(display, options, notifyCallback);
    
    this._parts = new PartManager(this);
    this._stateManager = new StateManager();
    this._renderOptions = null;
    this._viewerOptions = null;
    this._lastPartsData = null;
    
    // Override getNodeColor to use duck typing instead of instanceof
    // This fixes color lookup for dynamically added parts where
    // ObjectGroup instanceof check fails due to separate class copies
    this.getNodeColor = this._getNodeColorFixed;
    
    // Override setObject to use duck typing instead of instanceof
    // This fixes visibility toggle for dynamically added parts
    this.setObject = this._setObjectFixed;
  }

  /**
   * Fixed getNodeColor that uses duck typing instead of instanceof ObjectGroup.
   * The original relies on instanceof which fails for our dynamically created groups.
   * @param {string} path - Node path without leading slash
   * @returns {string|null} - Hex color string or null
   */
  _getNodeColorFixed = (path) => {
    const group = this.nestedGroup?.groups?.["/" + path];
    if (!group) return null;
    
    // Duck type check: group should have children with materials
    // This matches ObjectGroup structure without instanceof
    if (!group.children || group.children.length === 0) return null;
    
    // Find the front material color (same logic as original getNodeColor)
    let color = null;
    const firstChild = group.children[0];
    if (firstChild?.material?.color) {
      if (firstChild.type !== "Mesh" || firstChild.material.name === "frontMaterial") {
        color = firstChild.material.color;
      } else if (group.children[1]?.material?.color) {
        color = group.children[1].material.color;
      }
    }
    
    return color ? "#" + color.getHexString() : null;
  };

  /**
   * Fixed setObject that uses duck typing instead of instanceof ObjectGroup.
   * The original relies on instanceof which fails for our dynamically created groups.
   * @param {string} path - Node path (with leading slash)
   * @param {number} state - 0 or 1 for visibility
   * @param {number} iconNumber - 0 for shape, 1 for edges
   * @param {boolean} notify - Whether to notify state change
   * @param {boolean} update - Whether to trigger render update
   */
  _setObjectFixed = (path, state, iconNumber, notify = true, update = true) => {
    const objectGroup = this.nestedGroup?.groups?.[path];
    if (!objectGroup) return;
    
    // Duck type check: must have setShapeVisible and setEdgesVisible methods
    if (typeof objectGroup.setShapeVisible !== 'function' || 
        typeof objectGroup.setEdgesVisible !== 'function') {
      return;
    }
    
    if (iconNumber === 0) {
      objectGroup.setShapeVisible(state === 1);
    } else {
      objectGroup.setEdgesVisible(state === 1);
    }
    
    // Note: Original Viewer.setObject calls notifyStates here, but we don't need
    // state change notifications for our use case (visibility is managed internally)
    
    if (update) {
      this.update(this.updateMarker);
    }
  };

  /**
   * Get the PartManager for direct part manipulation.
   * @returns {PartManager}
   */
  get parts() {
    return this._parts;
  }

  /**
   * Get the StateManager for visibility state management.
   * @returns {StateManager}
   */
  get stateManager() {
    return this._stateManager;
  }

  /**
   * Override render to initialize PartManager after scene is built.
   */
  render(shapesData, renderOptions, viewerOptions) {
    this._renderOptions = renderOptions;
    this._viewerOptions = viewerOptions;
    this._parts.setRenderOptions(renderOptions);
    this._lastPartsData = shapesData?.parts || [];
    
    const result = super.render(shapesData, renderOptions, viewerOptions);
    
    // Build part map from viewer's state after render
    this._parts.buildFromViewer();
    
    // Initialize state manager with initial part states
    this._stateManager.initFromParts(this._lastPartsData);
    
    return result;
  }

  /**
   * Sync parts with new data - intelligently add, remove, or update.
   * Preserves camera position and visibility states.
   * 
   * @param {Object} shapesData - Shape data with parts array
   * @param {Object} options - Sync options
   * @param {boolean} options.updateTree - Whether to update the tree view (default: true)
   * @returns {boolean} true if sync succeeded
   */
  syncParts(shapesData, options = {}) {
    const { updateTree = true } = options;
    
    if (!this.ready || !this.nestedGroup?.groups) {
      return false;
    }

    if (!shapesData?.parts) {
      return false;
    }

    // Save visibility states from tree before sync
    this._stateManager.saveFromTree(this.treeview);
    
    // Use PartManager to sync geometries
    const stats = this._parts.sync(shapesData.parts);
    
    // Clean up states for removed parts
    const currentIds = new Set(shapesData.parts.map(p => p.id));
    this._stateManager.cleanupRemoved(currentIds);
    
    // Initialize states for new parts
    this._stateManager.initFromParts(shapesData.parts);
    
    // Update tree view if parts were added or removed
    if (updateTree && (stats.added > 0 || stats.removed > 0)) {
      this._rebuildTreeView(shapesData.parts);
    }
    
    // Apply saved visibility states to all groups
    this._stateManager.applyToGroups(this.nestedGroup.groups);
    
    this._lastPartsData = shapesData.parts;

    // Trigger three.js update
    this.update(this.updateMarker);
    return true;
  }

  /**
   * Rebuild the tree view to reflect current parts.
   * Uses StateManager for visibility state preservation.
   * @private
   */
  _rebuildTreeView(partsData) {
    if (!this.treeview || !this.display) {
      return;
    }

    // Build new tree structure from parts, using saved states
    const newTree = this._buildTreeFromParts(partsData);
    
    // Update viewer's tree properties
    this.tree = newTree;
    this.expandedTree = newTree;
    this.compactTree = newTree;
    
    // Dispose old treeview
    if (this.treeview.dispose) {
      this.treeview.dispose();
    }
    
    // Clear the tree container
    this.display.clearCadTree();
    
    // Create new TreeView using the internal constructor pattern
    try {
      const TreeViewClass = this.treeview.constructor;
      
      this.treeview = new TreeViewClass(
        this.tree,
        this.display.cadTreeScrollContainer,
        this.setObject,
        this.handlePick,
        this.update,
        this.notifyStates,
        this.getNodeColor,
        this.theme,
        this.newTreeBehavior,
        false // debug
      );
      
      const treeElement = this.treeview.create();
      this.display.addCadTree(treeElement);
      this.treeview.render();
      
      // Apply collapse setting from viewer options
      switch (this.collapse) {
        case COLLAPSE_MODE.EXPAND_ALL:
          this.treeview.expandAll();
          break;
        case COLLAPSE_MODE.ROOT_ONLY:
          this.treeview.openLevel(-1);
          break;
        case COLLAPSE_MODE.COLLAPSE_ALL:
          this.treeview.collapseAll();
          break;
        case COLLAPSE_MODE.FIRST_LEVEL:
          this.treeview.openLevel(1);
          break;
      }
    } catch (e) {
      console.warn('[LiveViewer] Could not rebuild tree view:', e.message);
    }
  }

  /**
   * Build a tree structure from parts data.
   * Tree structure must match part IDs so paths align.
   * Part ID "/Group/MyBox" -> tree { Group: { MyBox: [1,1] } }
   * @param {Array} partsData - Parts data
   * @private
   */
  _buildTreeFromParts(partsData) {
    const tree = {};
    
    for (const part of partsData) {
      const id = part.id || '';
      
      // Parse path segments from ID (e.g., "/Group/MyBox" -> ["Group", "MyBox"])
      const segments = id.split('/').filter(s => s);
      
      if (segments.length === 0) continue;
      
      // Use saved state from StateManager, or part's default state
      const state = this._stateManager.get(id);
      
      // Build nested structure
      let current = tree;
      for (let i = 0; i < segments.length - 1; i++) {
        const seg = segments[i];
        if (!current[seg]) {
          current[seg] = {};
        }
        current = current[seg];
      }
      
      // Set leaf with state
      const leafName = segments[segments.length - 1];
      current[leafName] = state;
    }
    
    return tree;
  }

  /**
   * Get a part handle by ID for direct manipulation.
   * @param {string} id - Part ID
   * @returns {PartHandle|null}
   */
  getPart(id) {
    return this._parts.get(id);
  }

  /**
   * Update a single part's geometry and transform.
   * @param {string} id - Part ID
   * @param {Object} partData - Part data with shape and/or loc
   */
  updatePart(id, partData) {
    this._parts.update(id, partData);
    this.update(this.updateMarker);
  }

  /**
   * Add a new part to the scene.
   * @param {Object} partData - Part data
   * @returns {PartHandle|null}
   */
  addPart(partData) {
    const handle = this._parts.add(partData);
    if (handle) {
      // Initialize state for new part
      this._stateManager.initFromParts([partData]);
      this.update(this.updateMarker);
    }
    return handle;
  }

  /**
   * Remove a part from the scene.
   * @param {string} id - Part ID
   */
  removePart(id) {
    this._parts.remove(id);
    this._stateManager.remove(id);
    this.update(this.updateMarker);
  }
}
