/**
 * LiveViewer - Extends three-cad-viewer's Viewer with reactive part updates.
 * 
 * Uses v4's native addPart/removePart API for dynamic part management.
 */

import { Viewer } from "three-cad-viewer";
import { COLLAPSE_MODE } from "./constants.js";

export class LiveViewer extends Viewer {
  constructor(display, options, notifyCallback) {
    super(display, options, notifyCallback);
    this._currentParts = new Map(); // id -> part data
  }

  /**
   * Sync parts with new data, preserving camera position.
   * Uses native addPart/removePart for efficient updates.
   * 
   * @param {Object} shapesData - The new shapes data
   * @returns {boolean} - True if sync was successful
   */
  syncParts(shapesData) {
    if (!this.ready || !shapesData?.parts) {
      return false;
    }

    const newParts = new Map();
    for (const part of shapesData.parts) {
      if (part.id) {
        newParts.set(part.id, part);
      }
    }

    const currentIds = new Set(this._currentParts.keys());
    const newIds = new Set(newParts.keys());

    // Find parts to remove and add
    const toRemove = [...currentIds].filter(id => !newIds.has(id));
    const toAdd = [...newIds].filter(id => !currentIds.has(id));

    // If no changes, nothing to do
    if (toRemove.length === 0 && toAdd.length === 0) {
      return true;
    }

    try {
      // Remove old parts
      for (const id of toRemove) {
        try {
          this.removePart(id);
        } catch (e) {
          console.warn(`[marimo-cad] Failed to remove part ${id}:`, e.message);
        }
      }

      // Add new parts
      // Get the root path from shapes data
      const rootPath = shapesData.id || "/Group";
      
      for (const id of toAdd) {
        const partData = newParts.get(id);
        try {
          this.addPart(rootPath, partData);
        } catch (e) {
          console.warn(`[marimo-cad] Failed to add part ${id}:`, e.message);
        }
      }

      // Update tracking
      this._currentParts = newParts;

      // Expand tree to show all parts
      this.collapseNodes(COLLAPSE_MODE.EXPAND_ALL);

      return true;
    } catch (e) {
      console.warn('[marimo-cad] syncParts failed:', e.message);
      return false;
    }
  }

  /**
   * Override render to track initial parts.
   */
  render(shapes, renderOptions, viewerOptions) {
    super.render(shapes, renderOptions, viewerOptions);
    
    // Track initial parts
    this._currentParts = new Map();
    if (shapes?.parts) {
      for (const part of shapes.parts) {
        if (part.id) {
          this._currentParts.set(part.id, part);
        }
      }
    }
    
    // Expand tree
    this.collapseNodes(COLLAPSE_MODE.EXPAND_ALL);
  }
}
