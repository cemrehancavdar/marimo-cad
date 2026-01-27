/**
 * PartManager - Clean abstraction over three-cad-viewer's internal part management
 * 
 * Uses real ObjectGroup instances via createCADGroup() for full compatibility with:
 * - Clipping (instanceof ObjectGroup check)
 * - NestedGroup methods (_traverse, selection, etc.)
 * - All material controls
 * 
 * ClippingExtension adds clipping stencils to dynamically added parts.
 */

import * as THREE from "three";
import { createCADGroup, updateOptionsFromDisplay } from "./cad-group-factory.js";
import { ClippingExtension } from "./clipping-extension.js";

/**
 * PartHandle - Clean interface to manipulate a single part in the scene.
 * Wraps an ObjectGroup and provides convenient methods.
 */
export class PartHandle {
  /**
   * @param {string} id - Part ID (path like "/Group/PartName")
   * @param {ObjectGroup} group - ObjectGroup instance
   */
  constructor(id, group) {
    this.id = id;
    this._group = group;
    this._disposed = false;
  }

  /** Check if this handle is still valid */
  get isValid() {
    return !this._disposed && this._group && this._group.parent;
  }

  /** Get the ObjectGroup for this part */
  get group() {
    return this._group;
  }

  /** Get the geometry */
  get geometry() {
    return this._group?.shapeGeometry;
  }

  /** Set part position */
  setPosition(x, y, z) {
    if (!this.isValid) return;
    this._group.position.set(x, y, z);
  }

  /** Set part rotation as quaternion */
  setQuaternion(x, y, z, w) {
    if (!this.isValid) return;
    this._group.quaternion.set(x, y, z, w);
  }

  /** Set position and quaternion from loc array [[x,y,z], [qx,qy,qz,qw]] */
  setTransform(loc) {
    if (!this.isValid || !loc) return;
    const [pos, quat] = loc;
    if (pos) this.setPosition(pos[0], pos[1], pos[2]);
    if (quat) this.setQuaternion(quat[0], quat[1], quat[2], quat[3]);
  }

  /** Update geometry buffers */
  updateGeometry(vertices, normals, triangles) {
    if (!this.isValid) return;
    
    const geometry = this._group.shapeGeometry;
    if (!geometry) return;

    const positions = vertices instanceof Float32Array ? vertices : new Float32Array(vertices);
    const normalsArr = normals instanceof Float32Array ? normals : new Float32Array(normals);
    const indices = triangles instanceof Uint32Array ? triangles : new Uint32Array(triangles);

    this._updateBufferAttribute(geometry, 'position', positions, 3);
    this._updateBufferAttribute(geometry, 'normal', normalsArr, 3);
    this._updateIndex(geometry, indices);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  }

  /** Update edge geometry */
  updateEdges(edgeData) {
    if (!this.isValid) return;
    
    const edges = this._group.types?.edges;
    if (!edges?.geometry?.setPositions) return;
    
    const positions = edgeData instanceof Float32Array ? edgeData : new Float32Array(edgeData);
    edges.geometry.setPositions(positions);
  }

  /** Dispose of this part's resources */
  dispose() {
    if (this._disposed) return;

    // Use ObjectGroup's dispose method which handles cleanup properly
    if (this._group) {
      // Remove from parent first
      if (this._group.parent) {
        this._group.parent.remove(this._group);
      }
      
      // ObjectGroup.dispose() handles geometry and material cleanup
      if (typeof this._group.dispose === 'function') {
        this._group.dispose();
      }
    }

    this._disposed = true;
  }

  /** @private Update a buffer attribute, reusing if size matches */
  _updateBufferAttribute(geometry, name, data, itemSize) {
    const attr = geometry.attributes[name];
    if (attr && attr.array.length === data.length) {
      attr.array.set(data);
      attr.needsUpdate = true;
    } else {
      geometry.setAttribute(name, new THREE.BufferAttribute(data, itemSize));
    }
  }

  /** @private Update geometry index */
  _updateIndex(geometry, data) {
    const attr = geometry.index;
    if (attr && attr.array.length === data.length) {
      attr.array.set(data);
      attr.needsUpdate = true;
    } else {
      geometry.setIndex(new THREE.BufferAttribute(data, 1));
    }
  }
}


/**
 * PartManager - Manages all parts in the scene.
 * 
 * Provides a clean API for adding, removing, and updating parts
 * using real ObjectGroup instances for full three-cad-viewer compatibility.
 */
export class PartManager {
  /**
   * @param {Object} viewer - LiveViewer instance
   */
  constructor(viewer) {
    this._viewer = viewer;
    this._parts = new Map();  // id -> PartHandle
    this._renderOptions = null;
    this._clippingExt = new ClippingExtension(viewer);
  }

  /** Get the ClippingExtension */
  get clipping() {
    return this._clippingExt;
  }

  /** Set render options for new parts */
  setRenderOptions(opts) {
    this._renderOptions = opts;
  }

  /** Get render options with display dimensions */
  _getOptions() {
    return updateOptionsFromDisplay(
      this._renderOptions || {},
      this._viewer?.display
    );
  }

  /** Get a part by ID */
  get(id) {
    return this._parts.get(id) || null;
  }

  /** Check if a part exists */
  has(id) {
    return this._parts.has(id);
  }

  /** Get all part IDs */
  ids() {
    return Array.from(this._parts.keys());
  }

  /** Get all parts */
  all() {
    return Array.from(this._parts.values());
  }

  /** 
   * Build part map from viewer's current state (after initial render).
   * Maps three-cad-viewer's ObjectGroups to PartHandles.
   */
  buildFromViewer() {
    this._parts.clear();
    
    const groups = this._viewer?.nestedGroup?.groups;
    if (!groups) return;

    for (const [path, group] of Object.entries(groups)) {
      if (!path) continue;

      const handle = new PartHandle(path, group);
      this._parts.set(path, handle);
    }
  }

  /**
   * Add a new part to the scene using a real ObjectGroup.
   * @param {Object} partData - Part data with shape, color, etc.
   * @returns {PartHandle|null}
   */
  add(partData) {
    const { id, loc } = partData;
    
    if (!partData.shape?.vertices || !this._viewer?.nestedGroup?.rootGroup) {
      return null;
    }

    // Create real ObjectGroup via factory
    const group = createCADGroup(partData, this._getOptions());

    // Add to scene
    this._viewer.nestedGroup.rootGroup.add(group);

    // Register with viewer's internal groups
    this._viewer.nestedGroup.groups[id] = group;

    // Setup clipping stencils (if clipping is enabled)
    this._clippingExt.setupClipping(group);

    // Create and store handle
    const handle = new PartHandle(id, group);
    this._parts.set(id, handle);

    // Apply transform
    if (loc) {
      handle.setTransform(loc);
    }

    return handle;
  }

  /**
   * Remove a part from the scene.
   * @param {string} id - Part ID to remove
   */
  remove(id) {
    const handle = this._parts.get(id);
    if (handle) {
      // Remove clipping first
      this._clippingExt.removeClipping(handle.group);
      
      // Dispose handle (removes from scene and cleans up)
      handle.dispose();
      this._parts.delete(id);
    }

    // Also clean up viewer's internal groups
    if (this._viewer?.nestedGroup?.groups?.[id]) {
      delete this._viewer.nestedGroup.groups[id];
    }
  }

  /**
   * Update an existing part's geometry and transform.
   * @param {string} id - Part ID
   * @param {Object} partData - New part data
   */
  update(id, partData) {
    let handle = this._parts.get(id);
    
    // If we don't have a handle, try to create one from viewer's groups
    if (!handle) {
      const group = this._viewer?.nestedGroup?.groups?.[id];
      if (group) {
        handle = new PartHandle(id, group);
        this._parts.set(id, handle);
      }
    }

    if (!handle || !handle.isValid) return;

    const { shape, loc } = partData;

    // Update geometry if provided
    if (shape?.vertices) {
      handle.updateGeometry(shape.vertices, shape.normals, shape.triangles);
      
      if (shape.edges) {
        handle.updateEdges(shape.edges);
      }
    }

    // Update transform if provided
    if (loc) {
      handle.setTransform(loc);
    }
  }

  /**
   * Sync parts with new data - intelligently add, remove, update.
   * @param {Array} partsData - Array of part data objects
   * @returns {Object} - { added, updated, removed } counts
   */
  sync(partsData) {
    const newIds = new Set(partsData.map(p => p.id));
    const existingIds = new Set(this._parts.keys());
    
    // Also include parts from viewer that we might not have tracked yet
    const viewerIds = this._getViewerPartIds();
    for (const id of viewerIds) {
      existingIds.add(id);
    }

    const stats = { added: 0, updated: 0, removed: 0 };

    // Remove parts not in new data
    for (const id of existingIds) {
      if (!newIds.has(id)) {
        this.remove(id);
        stats.removed++;
      }
    }

    // Add or update parts
    for (const partData of partsData) {
      if (existingIds.has(partData.id)) {
        this.update(partData.id, partData);
        stats.updated++;
      } else {
        this.add(partData);
        stats.added++;
      }
    }

    return stats;
  }

  /** @private Get all part IDs (paths) from viewer's groups */
  _getViewerPartIds() {
    const ids = new Set();
    const groups = this._viewer?.nestedGroup?.groups;
    if (!groups) return ids;

    for (const path of Object.keys(groups)) {
      if (path) ids.add(path);
    }
    return ids;
  }

  /** Clear all parts */
  clear() {
    for (const handle of this._parts.values()) {
      this._clippingExt.removeClipping(handle.group);
      handle.dispose();
    }
    this._parts.clear();
  }
}
