/**
 * LiveViewer - Extended three-cad-viewer v4.1 with batched geometry updates
 * 
 * Uses v4.1's batched API for optimal performance:
 * - skipBounds option defers expensive bounds recalculation
 * - updateBounds() called once after batch operations
 * - ensureStencilSize() pre-allocates clipping planes
 * - updatePart() for in-place geometry updates (falls back to remove+add internally)
 * 
 * See: https://github.com/bernhard-42/three-cad-viewer/issues/36
 */

import { Viewer } from "three-cad-viewer";
import { COLLAPSE_MODE } from "./constants.js";

/**
 * Check if two loc arrays are equal.
 * loc format: [[x, y, z], [qx, qy, qz, qw]]
 */
function locsEqual(loc1, loc2) {
  if (!loc1 && !loc2) return true;
  if (!loc1 || !loc2) return false;
  
  const [pos1, quat1] = loc1;
  const [pos2, quat2] = loc2;
  
  // Compare positions (allow small epsilon for floating point)
  const eps = 1e-6;
  for (let i = 0; i < 3; i++) {
    if (Math.abs((pos1?.[i] || 0) - (pos2?.[i] || 0)) > eps) return false;
  }
  for (let i = 0; i < 4; i++) {
    if (Math.abs((quat1?.[i] || 0) - (quat2?.[i] || 0)) > eps) return false;
  }
  return true;
}

/**
 * Extended Viewer with batched geometry updates using v4.1 API.
 * 
 * Usage:
 *   const viewer = new LiveViewer(display, options, callback);
 *   viewer.render(shapesData, renderOptions, viewerOptions);  // Initial render
 *   viewer.syncParts(newShapesData);  // Update parts (camera preserved)
 */
export class LiveViewer extends Viewer {
  constructor(display, options, notifyCallback) {
    super(display, options, notifyCallback);
    
    this._currentPartNames = new Set();
    this._currentPartLocs = new Map(); // Track loc for each part
    this._parentPath = null;
    this._expectedBounds = null;
  }

  /**
   * Set expected bounds for slider ranges.
   * Call this after render() to pre-allocate stencil planes.
   * 
   * @param {Object} bounds - { xmin, xmax, ymin, ymax, zmin, zmax }
   */
  setExpectedBounds(bounds) {
    this._expectedBounds = bounds;
    if (typeof this.ensureStencilSize === "function") {
      this.ensureStencilSize(bounds);
    }
  }

  /**
   * Override render to track initial parts and optionally pre-allocate stencils.
   */
  render(shapesData, renderOptions, viewerOptions) {
    const result = super.render(shapesData, renderOptions, viewerOptions);
    
    this._currentPartNames.clear();
    this._currentPartLocs.clear();
    this._parentPath = shapesData?.id || "/Group";
    
    for (const part of shapesData?.parts || []) {
      this._currentPartNames.add(part.name);
      this._currentPartLocs.set(part.name, part.loc);
    }
    
    // Pre-allocate stencil if bounds were set
    if (this._expectedBounds && typeof this.ensureStencilSize === "function") {
      this.ensureStencilSize(this._expectedBounds);
    }
    
    this.collapseNodes(COLLAPSE_MODE.EXPAND_ALL);
    
    return result;
  }

  /**
   * Sync parts with new data using batched operations.
   * 
   * Uses TCV v4.1 API:
   * - updatePart() for existing parts (handles buffer updates + fallback internally)
   * - addPart() for new parts
   * - removePart() for removed parts
   * - All with skipBounds, then single updateBounds() at end
   * 
   * @param {Object} shapesData - Shape data with parts array
   * @returns {boolean} true if sync succeeded
   */
  syncParts(shapesData) {
    if (!this.ready || !shapesData?.parts) {
      return false;
    }

    const parentPath = shapesData.id || this._parentPath || "/Group";
    const newPartNames = new Set(shapesData.parts.map(p => p.name));

    // Phase 1: Remove parts not in new data
    for (const name of this._currentPartNames) {
      if (!newPartNames.has(name)) {
        try {
          this.removePart(`${parentPath}/${name}`, { skipBounds: true });
        } catch (e) {
          // Part might already be removed
        }
      }
    }

    // Phase 2: Update existing or add new parts
    for (const part of shapesData.parts) {
      const path = `${parentPath}/${part.name}`;
      
      if (this._currentPartNames.has(part.name)) {
        // Existing part - check if loc changed (TCV updatePart doesn't handle loc)
        const oldLoc = this._currentPartLocs.get(part.name);
        const locChanged = !locsEqual(oldLoc, part.loc);
        
        if (locChanged) {
          // Loc changed - must remove and re-add (updatePart doesn't update transforms)
          try {
            this.removePart(path, { skipBounds: true });
            this.addPart(parentPath, part, { skipBounds: true });
          } catch (e) {
            console.warn(`[marimo-cad] Failed to relocate part ${part.name}:`, e.message);
          }
        } else {
          // Loc same - try updatePart for geometry changes
          try {
            this.updatePart(path, part, { skipBounds: true });
          } catch (e) {
            // updatePart failed - fall back to remove + add
            try {
              this.removePart(path, { skipBounds: true });
              this.addPart(parentPath, part, { skipBounds: true });
            } catch (e2) {
              console.warn(`[marimo-cad] Failed to update part ${part.name}:`, e2.message);
            }
          }
        }
      } else {
        // New part - add
        try {
          this.addPart(parentPath, part, { skipBounds: true });
        } catch (e) {
          console.warn(`[marimo-cad] Failed to add part ${part.name}:`, e.message);
        }
      }
    }

    // Phase 3: Finalize batch - recalculate bounds once
    this.updateBounds();

    // Update tracking
    this._currentPartNames = newPartNames;
    this._currentPartLocs.clear();
    for (const part of shapesData.parts) {
      this._currentPartLocs.set(part.name, part.loc);
    }
    this._parentPath = parentPath;

    this.collapseNodes(COLLAPSE_MODE.EXPAND_ALL);
    this.update(this.updateMarker);

    return true;
  }
}
