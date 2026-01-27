/**
 * StateManager - Manages visibility/selection state across tree rebuilds
 * 
 * The tree view in three-cad-viewer gets rebuilt when parts are added/removed.
 * This manager persists visibility states so they survive rebuilds.
 * 
 * State format: [shapeVisible, edgesVisible] where 1 = visible, 0 = hidden
 */

/**
 * Manages visibility state for CAD parts independently of tree view.
 */
export class StateManager {
  constructor() {
    /** @type {Map<string, [number, number]>} path -> [shapeVis, edgeVis] */
    this._states = new Map();
  }

  /**
   * Get state for a path, returns default [1, 1] if not found
   * @param {string} path - Part path (e.g., "/Group/PartName")
   * @returns {[number, number]} - [shapeVisible, edgesVisible]
   */
  get(path) {
    return this._states.get(path) || [1, 1];
  }

  /**
   * Set state for a path
   * @param {string} path - Part path
   * @param {[number, number]} state - [shapeVisible, edgesVisible]
   */
  set(path, state) {
    this._states.set(path, state);
  }

  /**
   * Remove state for a path
   * @param {string} path - Part path
   */
  remove(path) {
    this._states.delete(path);
  }

  /**
   * Check if a path has saved state
   * @param {string} path - Part path
   * @returns {boolean}
   */
  has(path) {
    return this._states.has(path);
  }

  /**
   * Get all states as an object
   * @returns {Object.<string, [number, number]>}
   */
  all() {
    return Object.fromEntries(this._states);
  }

  /**
   * Get number of saved states
   * @returns {number}
   */
  get size() {
    return this._states.size;
  }

  /**
   * Clear all states
   */
  clear() {
    this._states.clear();
  }

  /**
   * Save current states from tree view before rebuild.
   * @param {Object} treeview - TreeView instance with getStates() method
   */
  saveFromTree(treeview) {
    if (!treeview?.getStates) return;

    try {
      const states = treeview.getStates();
      for (const [path, state] of Object.entries(states)) {
        if (path && Array.isArray(state)) {
          this._states.set(path, state);
        }
      }
    } catch (e) {
      // Ignore errors if tree is in invalid state
      console.warn('[StateManager] Could not save states from tree:', e.message);
    }
  }

  /**
   * Apply saved states to ObjectGroups.
   * Called after tree rebuild to restore visibility.
   * @param {Object} groups - Map of path -> ObjectGroup
   */
  applyToGroups(groups) {
    if (!groups) return;

    for (const [path, state] of this._states) {
      const group = groups[path];
      if (!group) continue;

      // Apply shape visibility
      if (typeof group.setShapeVisible === 'function') {
        group.setShapeVisible(state[0] === 1);
      }

      // Apply edge visibility
      if (typeof group.setEdgesVisible === 'function') {
        group.setEdgesVisible(state[1] === 1);
      }
    }
  }

  /**
   * Apply state to a single group
   * @param {string} path - Part path
   * @param {Object} group - ObjectGroup instance
   */
  applyToGroup(path, group) {
    const state = this.get(path);
    
    if (typeof group.setShapeVisible === 'function') {
      group.setShapeVisible(state[0] === 1);
    }
    if (typeof group.setEdgesVisible === 'function') {
      group.setEdgesVisible(state[1] === 1);
    }
  }

  /**
   * Remove states for paths not in the current set.
   * Called after sync to clean up removed parts.
   * @param {Set<string>} currentPaths - Set of current part paths
   */
  cleanupRemoved(currentPaths) {
    for (const path of this._states.keys()) {
      if (!currentPaths.has(path)) {
        this._states.delete(path);
      }
    }
  }

  /**
   * Initialize states from parts data (for new parts).
   * Only sets state if not already saved.
   * @param {Array} partsData - Array of part data objects
   */
  initFromParts(partsData) {
    for (const part of partsData) {
      if (part.id && !this._states.has(part.id)) {
        // Use part's state if provided, otherwise default to visible
        const state = part.state || [1, 1];
        this._states.set(part.id, state);
      }
    }
  }
}
