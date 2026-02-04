/**
 * LiveViewer - Extended three-cad-viewer v4 with live geometry updates
 * 
 * Uses v4's addPart/removePart for add/remove, and direct buffer updates
 * for geometry changes (faster than remove+add).
 * 
 * See: https://github.com/bernhard-42/three-cad-viewer/issues/36
 */

import * as THREE from "three";
import { Viewer } from "three-cad-viewer";
import { COLLAPSE_MODE } from "./constants.js";

/**
 * Update geometry buffers directly (faster than remove+add).
 * @param {THREE.BufferGeometry} geometry - The geometry to update
 * @param {Float32Array|Array} vertices - New vertex positions
 * @param {Float32Array|Array} normals - New normals
 * @param {Uint32Array|Array} triangles - New triangle indices
 */
function updateGeometryBuffers(geometry, vertices, normals, triangles) {
  if (!geometry) return;

  const positions = vertices instanceof Float32Array ? vertices : new Float32Array(vertices);
  const normalsArr = normals instanceof Float32Array ? normals : new Float32Array(normals);
  const indices = triangles instanceof Uint32Array ? triangles : new Uint32Array(triangles);

  // Update position attribute
  const posAttr = geometry.attributes.position;
  if (posAttr && posAttr.array.length === positions.length) {
    posAttr.array.set(positions);
    posAttr.needsUpdate = true;
  } else {
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  }

  // Update normal attribute
  const normAttr = geometry.attributes.normal;
  if (normAttr && normAttr.array.length === normalsArr.length) {
    normAttr.array.set(normalsArr);
    normAttr.needsUpdate = true;
  } else {
    geometry.setAttribute("normal", new THREE.BufferAttribute(normalsArr, 3));
  }

  // Update index
  const idxAttr = geometry.index;
  if (idxAttr && idxAttr.array.length === indices.length) {
    idxAttr.array.set(indices);
    idxAttr.needsUpdate = true;
  } else {
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  }

  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

/**
 * Update edge geometry (LineSegments2).
 * @param {Object} group - ObjectGroup with edges
 * @param {Float32Array|Array} edgeData - New edge positions
 */
function updateEdgeGeometry(group, edgeData) {
  // Find edges child - it's a LineSegments2 with setPositions method
  for (const child of group.children || []) {
    if (child.geometry?.setPositions) {
      const positions = edgeData instanceof Float32Array ? edgeData : new Float32Array(edgeData);
      child.geometry.setPositions(positions);
      return;
    }
  }
}

/**
 * Extended Viewer with live geometry updates using v4 API + direct buffer updates.
 * 
 * Usage:
 *   const viewer = new LiveViewer(display, options, callback);
 *   viewer.render(shapesData, renderOptions, viewerOptions);  // Initial render
 *   viewer.syncParts(newShapesData);  // Update parts (camera preserved)
 */
export class LiveViewer extends Viewer {
  constructor(display, options, notifyCallback) {
    super(display, options, notifyCallback);
    
    // Track current part names
    this._currentPartNames = new Set();
    this._parentPath = null;
  }

  /**
   * Override render to track initial parts.
   */
  render(shapesData, renderOptions, viewerOptions) {
    const result = super.render(shapesData, renderOptions, viewerOptions);
    
    // Track all initial part names
    this._currentPartNames.clear();
    this._parentPath = shapesData?.id || "/Group";
    
    for (const part of shapesData?.parts || []) {
      this._currentPartNames.add(part.name);
    }
    
    // Expand tree by default
    this.collapseNodes(COLLAPSE_MODE.EXPAND_ALL);
    
    return result;
  }

  /**
   * Get an ObjectGroup by part name.
   * @param {string} name - Part name
   * @returns {Object|null} ObjectGroup or null
   */
  _getGroup(name) {
    const path = `${this._parentPath}/${name}`;
    return this.nestedGroup?.groups?.[path] || null;
  }

  /**
   * Update a part's geometry in-place (fast).
   * @param {string} name - Part name
   * @param {Object} part - Part data with shape
   * @returns {boolean} true if updated successfully
   */
  _updatePartGeometry(name, part) {
    const group = this._getGroup(name);
    if (!group || !group.shapeGeometry) return false;

    const shape = part.shape;
    if (!shape) return false;

    // Update shape geometry
    updateGeometryBuffers(
      group.shapeGeometry,
      shape.vertices || [],
      shape.normals || [],
      shape.triangles || []
    );

    // Update edges if present
    if (shape.edges?.length > 0) {
      updateEdgeGeometry(group, shape.edges);
    }

    // Update transform if present
    if (part.loc) {
      const [pos, quat] = part.loc;
      if (pos) group.position.set(pos[0], pos[1], pos[2]);
      if (quat) group.quaternion.set(quat[0], quat[1], quat[2], quat[3]);
    }

    return true;
  }

  /**
   * Sync parts with new data.
   * - Removes parts not in new data
   * - Updates existing parts with direct buffer writes (fast)
   * - Adds new parts using v4's addPart
   * 
   * Preserves camera position and viewer state.
   * 
   * @param {Object} shapesData - Shape data with parts array
   * @returns {boolean} true if sync succeeded
   */
  syncParts(shapesData) {
    if (!this.ready) {
      return false;
    }

    if (!shapesData?.parts) {
      return false;
    }

    const parentPath = shapesData.id || this._parentPath || "/Group";
    const newPartNames = new Set(shapesData.parts.map(p => p.name));

    // Remove parts not in new data
    for (const name of this._currentPartNames) {
      if (!newPartNames.has(name)) {
        try {
          this.removePart(`${parentPath}/${name}`);
        } catch (e) {
          console.warn(`[marimo-cad] Failed to remove part ${name}:`, e.message);
        }
      }
    }

    // Update existing parts or add new ones
    for (const part of shapesData.parts) {
      if (this._currentPartNames.has(part.name)) {
        // Existing part - try direct geometry update (fast)
        if (!this._updatePartGeometry(part.name, part)) {
          // Fallback to remove+add if direct update fails
          try {
            this.removePart(`${parentPath}/${part.name}`);
            this.addPart(parentPath, part);
          } catch (e) {
            console.warn(`[marimo-cad] Failed to update part ${part.name}:`, e.message);
          }
        }
      } else {
        // New part - add using v4 API
        try {
          this.addPart(parentPath, part);
        } catch (e) {
          console.warn(`[marimo-cad] Failed to add part ${part.name}:`, e.message);
        }
      }
    }

    // Update tracking
    this._currentPartNames = newPartNames;
    this._parentPath = parentPath;

    // Expand tree after changes
    this.collapseNodes(COLLAPSE_MODE.EXPAND_ALL);

    // Trigger render update
    this.update(this.updateMarker);

    return true;
  }
}
