/**
 * ClippingExtension - Adds clipping stencil meshes to dynamically added ObjectGroups
 * 
 * The Clipping class in three-cad-viewer only sets up clipping for objects
 * that exist at render time. This extension adds clipping support to parts
 * added after the initial render.
 * 
 * Stencil technique:
 * - backStencil: Increments stencil buffer where back faces are visible (inside clipped region)
 * - frontStencil: Decrements stencil buffer where front faces are visible
 * - Result: Stencil buffer != 0 only inside the clipped region
 */

import * as THREE from "three";

/**
 * Back stencil material - increments stencil where back faces visible.
 * Copied from three-cad-viewer/src/clipping.js
 */
const backStencilMaterial = new THREE.MeshBasicMaterial({
  depthWrite: false,
  depthTest: false,
  colorWrite: false,
  side: THREE.BackSide,

  stencilWrite: true,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilFail: THREE.IncrementWrapStencilOp,
  stencilZFail: THREE.IncrementWrapStencilOp,
  stencilZPass: THREE.IncrementWrapStencilOp,
});

/**
 * Front stencil material - decrements stencil where front faces visible.
 * Copied from three-cad-viewer/src/clipping.js
 */
const frontStencilMaterial = new THREE.MeshBasicMaterial({
  depthWrite: false,
  depthTest: false,
  colorWrite: false,
  side: THREE.FrontSide,

  stencilWrite: true,
  stencilFunc: THREE.AlwaysStencilFunc,
  stencilFail: THREE.DecrementWrapStencilOp,
  stencilZFail: THREE.DecrementWrapStencilOp,
  stencilZPass: THREE.DecrementWrapStencilOp,
});

/**
 * Create a stencil mesh for clipping
 * @param {string} name - Mesh name
 * @param {THREE.Material} material - Stencil material (front or back)
 * @param {THREE.BufferGeometry} geometry - Shape geometry
 * @param {THREE.Plane} plane - Clipping plane
 * @returns {THREE.Mesh}
 */
function createStencil(name, material, geometry, plane) {
  const mat = material.clone();
  mat.clippingPlanes = [plane];
  const mesh = new THREE.Mesh(geometry, mat);
  mesh.name = name;
  return mesh;
}

/**
 * Adds clipping support to dynamically added ObjectGroups.
 */
export class ClippingExtension {
  /**
   * @param {Object} viewer - LiveViewer instance
   */
  constructor(viewer) {
    this._viewer = viewer;
  }

  /**
   * Check if clipping is available (viewer has been rendered)
   * @returns {boolean}
   */
  get isReady() {
    return !!(this._viewer?.clipping?.clipPlanes);
  }

  /**
   * Get the clipping planes from the viewer
   * @returns {Array<THREE.Plane>|null}
   */
  get clipPlanes() {
    return this._viewer?.clipping?.clipPlanes || null;
  }

  /**
   * Setup clipping stencils for a newly added ObjectGroup.
   * Must be called AFTER viewer.clipping exists (after first render).
   * 
   * This replicates what the Clipping constructor does for each ObjectGroup:
   * 1. Creates front/back stencil meshes for each clipping plane (X, Y, Z)
   * 2. Adds them to the group via addType() so setShapeVisible() controls them
   * 3. Sets clip planes on the group's materials
   * 
   * @param {ObjectGroup} group - ObjectGroup instance to setup clipping for
   * @returns {boolean} - true if clipping was set up, false if not possible
   */
  setupClipping(group) {
    // Check if clipping is available
    if (!this.isReady) {
      return false;
    }

    // Only solid objects get clipping
    if (!group?.shapeGeometry || group.subtype !== "solid") {
      return false;
    }

    // Check if clipping already set up (avoid duplicates)
    if (group.types?.["clipping-0"]) {
      return false;
    }

    const clipPlanes = this.clipPlanes;
    const geometry = group.shapeGeometry;

    // For each clipping plane (0=X, 1=Y, 2=Z)
    for (let i = 0; i < 3; i++) {
      const plane = clipPlanes[i];

      // Create clipping group for this plane
      const clippingGroup = new THREE.Group();
      clippingGroup.name = `clipping-${i}`;

      // Front stencil - decrements stencil buffer
      const frontStencil = createStencil(
        `frontStencil-${i}`,
        frontStencilMaterial,
        geometry,
        plane
      );
      clippingGroup.add(frontStencil);

      // Back stencil - increments stencil buffer
      const backStencil = createStencil(
        `backStencil-${i}`,
        backStencilMaterial,
        geometry,
        plane
      );
      clippingGroup.add(backStencil);

      // Add to group via addType (so setShapeVisible() will control visibility)
      group.addType(clippingGroup, `clipping-${i}`);
    }

    // Set clip planes on the group's materials (front, back, edges)
    group.setClipPlanes(clipPlanes);

    return true;
  }

  /**
   * Remove clipping from a group (for cleanup)
   * @param {ObjectGroup} group - ObjectGroup instance
   */
  removeClipping(group) {
    if (!group?.types) return;

    for (let i = 0; i < 3; i++) {
      const key = `clipping-${i}`;
      const clippingGroup = group.types[key];
      if (clippingGroup) {
        // Dispose materials
        for (const child of clippingGroup.children) {
          if (child.material) {
            child.material.dispose();
          }
        }
        // Remove from group
        group.remove(clippingGroup);
        delete group.types[key];
      }
    }

    // Clear clip planes
    if (typeof group.setClipPlanes === 'function') {
      group.setClipPlanes(null);
    }
  }

  /**
   * Setup clipping for all groups that don't have it yet.
   * Useful after batch adding parts.
   * @param {Object} groups - Map of path -> ObjectGroup
   * @returns {number} - Number of groups that got clipping setup
   */
  setupClippingForAll(groups) {
    if (!groups || !this.isReady) return 0;

    let count = 0;
    for (const group of Object.values(groups)) {
      if (this.setupClipping(group)) {
        count++;
      }
    }
    return count;
  }
}
