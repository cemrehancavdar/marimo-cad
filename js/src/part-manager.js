/**
 * PartManager - Clean abstraction over three-cad-viewer's internal part management
 * 
 * three-cad-viewer quirks this abstracts:
 * - ObjectGroup extends THREE.Group (position/quaternion on group itself, not group.group)
 * - Groups stored with path keys like "/shapes/assembly/PartName"
 * - No built-in API for adding/removing individual parts after render
 */

import * as THREE from "three";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";

/**
 * PartHandle - Clean interface to manipulate a single part in the scene.
 */
export class PartHandle {
  constructor(id, threeGroup, geometry, options = {}) {
    this.id = id;
    this._group = threeGroup;      // THREE.Group or ObjectGroup (both extend THREE.Group)
    this._geometry = geometry;      // BufferGeometry for the mesh
    this._edges = options.edges;    // LineSegments2 for edges (optional)
    this._disposed = false;
  }

  /** Check if this handle is still valid */
  get isValid() {
    return !this._disposed && this._group && this._group.parent;
  }

  /** Get the THREE.Group for this part */
  get group() {
    return this._group;
  }

  /** Get the geometry */
  get geometry() {
    return this._geometry;
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
    if (!this.isValid || !this._geometry) return;

    const positions = vertices instanceof Float32Array ? vertices : new Float32Array(vertices);
    const normalsArr = normals instanceof Float32Array ? normals : new Float32Array(normals);
    const indices = triangles instanceof Uint32Array ? triangles : new Uint32Array(triangles);

    this._updateBufferAttribute(this._geometry, 'position', positions, 3);
    this._updateBufferAttribute(this._geometry, 'normal', normalsArr, 3);
    this._updateIndex(this._geometry, indices);

    this._geometry.computeBoundingBox();
    this._geometry.computeBoundingSphere();
  }

  /** Update edge geometry */
  updateEdges(edgeData) {
    if (!this.isValid || !this._edges) return;
    
    const edgeGeom = this._edges.geometry;
    if (edgeGeom && edgeGeom.setPositions) {
      const positions = edgeData instanceof Float32Array ? edgeData : new Float32Array(edgeData);
      edgeGeom.setPositions(positions);
    }
  }

  /** Dispose of this part's resources */
  dispose() {
    if (this._disposed) return;

    if (this._group && this._group.parent) {
      this._group.parent.remove(this._group);
    }

    if (this._geometry) {
      this._geometry.dispose();
    }

    // Dispose materials on child meshes
    if (this._group) {
      this._group.traverse((child) => {
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
        if (child.geometry && child.geometry !== this._geometry) {
          child.geometry.dispose();
        }
      });
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
 * without worrying about three-cad-viewer's internal structure.
 */
export class PartManager {
  constructor(viewer) {
    this._viewer = viewer;
    this._parts = new Map();  // id -> PartHandle
    this._renderOptions = null;
  }

  /** Set render options for new parts */
  setRenderOptions(opts) {
    this._renderOptions = opts;
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
      // Extract part ID from path (e.g., "/shapes/assembly/Left" -> "Left")
      const id = path.split('/').pop();
      if (!id) continue;

      // ObjectGroup has shapeGeometry property
      const geometry = group.shapeGeometry;
      const edges = group.types?.edges;

      const handle = new PartHandle(id, group, geometry, { edges });
      this._parts.set(id, handle);
    }
  }

  /**
   * Find a part in viewer's groups by ID.
   * Handles path-based keys like "/shapes/assembly/PartName".
   * @private
   */
  _findViewerGroup(id) {
    const groups = this._viewer?.nestedGroup?.groups;
    if (!groups) return null;

    for (const [path, group] of Object.entries(groups)) {
      if (path === id || path.endsWith('/' + id)) {
        return { path, group };
      }
    }
    return null;
  }

  /**
   * Add a new part to the scene.
   * @param {Object} partData - Part data with shape, color, etc.
   * @returns {PartHandle|null}
   */
  add(partData) {
    const { id, name, shape, color, alpha, loc } = partData;
    
    if (!shape?.vertices || !this._viewer?.nestedGroup?.rootGroup) {
      return null;
    }

    const opts = this._renderOptions || {};
    const partColor = new THREE.Color(color || '#4a90d9');
    const partAlpha = alpha != null ? alpha : 1.0;

    // Create geometry
    const positions = shape.vertices instanceof Float32Array 
      ? shape.vertices : new Float32Array(shape.vertices);
    const normals = shape.normals instanceof Float32Array
      ? shape.normals : new Float32Array(shape.normals);
    const triangles = shape.triangles instanceof Uint32Array
      ? shape.triangles : new Uint32Array(shape.triangles);

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
    geometry.setIndex(new THREE.BufferAttribute(triangles, 1));
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    // Create materials
    const frontMaterial = new THREE.MeshStandardMaterial({
      color: partColor,
      metalness: opts.metalness || 0.3,
      roughness: opts.roughness || 0.65,
      polygonOffset: true,
      polygonOffsetFactor: 1.0,
      polygonOffsetUnits: 1.0,
      transparent: true,
      opacity: partAlpha,
      depthWrite: partAlpha >= 1.0,
      side: THREE.FrontSide,
    });

    const backMaterial = new THREE.MeshBasicMaterial({
      color: partColor,
      side: THREE.BackSide,
      polygonOffset: true,
      polygonOffsetFactor: 1.0,
      polygonOffsetUnits: 1.0,
      transparent: true,
      opacity: partAlpha,
      depthWrite: partAlpha >= 1.0,
    });

    // Create meshes
    const frontMesh = new THREE.Mesh(geometry, frontMaterial);
    frontMesh.name = name || id;
    
    const backMesh = new THREE.Mesh(geometry, backMaterial);
    backMesh.name = name || id;

    // Create group
    const partGroup = new THREE.Group();
    partGroup.name = id;
    partGroup.add(frontMesh);
    partGroup.add(backMesh);

    // Create edges if provided
    let edges = null;
    if (shape.edges?.length > 0) {
      const edgePositions = shape.edges instanceof Float32Array
        ? shape.edges : new Float32Array(shape.edges);
      
      const edgeGeometry = new LineSegmentsGeometry();
      edgeGeometry.setPositions(edgePositions);

      const edgeMaterial = new LineMaterial({
        color: opts.edgeColor || 0x333333,
        linewidth: 1,
        transparent: true,
        depthWrite: true,
      });
      edgeMaterial.resolution.set(
        this._viewer.display?.cadWidth || 800,
        this._viewer.display?.height || 500
      );

      edges = new LineSegments2(edgeGeometry, edgeMaterial);
      edges.name = `${name || id}_edges`;
      edges.renderOrder = 999;
      partGroup.add(edges);
    }

    // Add to scene
    this._viewer.nestedGroup.rootGroup.add(partGroup);

    // Register with viewer's internal groups
    this._viewer.nestedGroup.groups[id] = {
      shapeGeometry: geometry,
      types: { front: frontMesh, back: backMesh, edges },
      // Note: for our added parts, the group IS partGroup
      // We store it but PartHandle handles the abstraction
    };

    // Create and store handle
    const handle = new PartHandle(id, partGroup, geometry, { edges });
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
      handle.dispose();
      this._parts.delete(id);
    }

    // Also clean up viewer's internal groups
    const found = this._findViewerGroup(id);
    if (found) {
      const { path, group } = found;
      
      // Remove from scene if not already done by handle
      if (group.parent) {
        group.parent.remove(group);
      }

      // Dispose viewer-created resources
      if (group.shapeGeometry) {
        group.shapeGeometry.dispose();
      }
      if (group.types) {
        for (const mesh of Object.values(group.types)) {
          if (mesh?.material) mesh.material.dispose();
          if (mesh?.geometry) mesh.geometry.dispose();
        }
      }

      delete this._viewer.nestedGroup.groups[path];
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
      const found = this._findViewerGroup(id);
      if (found) {
        const { group } = found;
        handle = new PartHandle(id, group, group.shapeGeometry, { 
          edges: group.types?.edges 
        });
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

  /** @private Get all part IDs from viewer's groups */
  _getViewerPartIds() {
    const ids = new Set();
    const groups = this._viewer?.nestedGroup?.groups;
    if (!groups) return ids;

    for (const path of Object.keys(groups)) {
      const id = path.split('/').pop();
      if (id) ids.add(id);
    }
    return ids;
  }

  /** Clear all parts */
  clear() {
    for (const handle of this._parts.values()) {
      handle.dispose();
    }
    this._parts.clear();
  }
}
