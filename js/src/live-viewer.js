/**
 * LiveViewer - Extended three-cad-viewer with live geometry updates
 * 
 * Provides reactive part management via PartManager abstraction.
 * Camera position preserved across updates.
 */

import { Viewer } from "three-cad-viewer";
import { PartManager } from "./part-manager.js";

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
    this._renderOptions = null;
    this._viewerOptions = null;
    this._lastPartsData = null;
  }

  /**
   * Get the PartManager for direct part manipulation.
   * @returns {PartManager}
   */
  get parts() {
    return this._parts;
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
    
    return result;
  }

  /**
   * Sync parts with new data - intelligently add, remove, or update.
   * Preserves camera position and scene state.
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

    // Use PartManager to sync geometries
    const stats = this._parts.sync(shapesData.parts);
    
    // Update tree view if parts were added or removed
    if (updateTree && (stats.added > 0 || stats.removed > 0)) {
      this._rebuildTreeView(shapesData.parts);
    }
    
    this._lastPartsData = shapesData.parts;

    // Trigger three.js update
    this.update(true);
    return true;
  }

  /**
   * Rebuild the tree view to reflect current parts.
   * @private
   */
  _rebuildTreeView(partsData) {
    if (!this.treeview || !this.display) {
      return;
    }

    // Build new tree structure from parts
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
    // Note: We access the internal TreeView class via the prototype chain
    try {
      // Get the TreeView constructor from an existing instance
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
      
      // Apply collapse setting
      switch (this.collapse) {
        case 0:
          this.treeview.expandAll();
          break;
        case 1:
          this.treeview.openLevel(-1);
          break;
        case 2:
          this.treeview.collapseAll();
          break;
        case 3:
          this.treeview.openLevel(1);
          break;
      }
    } catch (e) {
      console.warn('[LiveViewer] Could not rebuild tree view:', e.message);
    }
  }

  /**
   * Build a tree structure from parts data.
   * The tree structure expected by three-cad-viewer is:
   * { "shapes": { "PartName": [shapeVisible, edgesVisible], ... } }
   * @private
   */
  _buildTreeFromParts(partsData) {
    const shapes = {};
    
    for (const part of partsData) {
      const name = part.name || part.id || 'Part';
      // [1, 1] = [shape visible, edges visible]
      const state = part.state || [1, 1];
      shapes[name] = state;
    }
    
    return { shapes };
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
    this.update(true);
  }

  /**
   * Add a new part to the scene.
   * @param {Object} partData - Part data
   * @returns {PartHandle|null}
   */
  addPart(partData) {
    const handle = this._parts.add(partData);
    if (handle) {
      this.update(true);
    }
    return handle;
  }

  /**
   * Remove a part from the scene.
   * @param {string} id - Part ID
   */
  removePart(id) {
    this._parts.remove(id);
    this.update(true);
  }
}
