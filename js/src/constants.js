/**
 * Shared constants for marimo-cad viewer
 * Single source of truth for defaults and configuration
 */

// =============================================================================
// Layout Constants
// =============================================================================

/** Default tree panel width in pixels */
export const TREE_WIDTH = 200;

/** Internal padding added by three-cad-viewer (~12px for borders/padding) */
export const INTERNAL_PADDING = 12;

/** Minimum CAD view width in pixels */
export const MIN_CAD_WIDTH = 400;

/** Fallback width when container measurement fails */
export const FALLBACK_WIDTH = 800;

/** Debounce delay for resize events in milliseconds */
export const RESIZE_DEBOUNCE_MS = 100;

// =============================================================================
// Default Colors
// =============================================================================

/** Default part color (yellow/gold) */
export const DEFAULT_PART_COLOR = "#e8b024";

/** Default edge color (dark gray) */
export const DEFAULT_EDGE_COLOR = 0x333333;

// =============================================================================
// Render Options (three-cad-viewer)
// =============================================================================

/** Default render options for three-cad-viewer */
export const DEFAULT_RENDER_OPTIONS = {
  ambientIntensity: 1.0,
  directIntensity: 1.1,
  metalness: 0.3,
  roughness: 0.65,
  edgeColor: DEFAULT_EDGE_COLOR,
  defaultOpacity: 0.5,
  normalLen: 0,
};

// =============================================================================
// Viewer Options (three-cad-viewer)
// =============================================================================

/**
 * Tree collapse mode constants
 * @see https://github.com/bernhard-42/three-cad-viewer
 */
export const COLLAPSE_MODE = {
  EXPAND_ALL: 0,    // Show all nodes expanded
  ROOT_ONLY: 1,     // Collapse to root level only
  COLLAPSE_ALL: 2,  // All nodes collapsed
  FIRST_LEVEL: 3,   // Expand first level only
};

/** Default viewer options for three-cad-viewer */
export const DEFAULT_VIEWER_OPTIONS = {
  up: "Z",
  axes: true,
  axes0: true,
  grid: [true, false, false],
  ortho: true,
  transparent: false,
  blackEdges: true,
  collapse: COLLAPSE_MODE.ROOT_ONLY,
};

// =============================================================================
// Part Defaults
// =============================================================================

/** Default part visibility state [shapeVisible, edgesVisible] */
export const DEFAULT_PART_STATE = [1, 1];

/** Default part alpha (fully opaque) */
export const DEFAULT_PART_ALPHA = 1.0;

// =============================================================================
// Display Options
// =============================================================================

/** Default display options for three-cad-viewer Display */
export const DEFAULT_DISPLAY_OPTIONS = {
  theme: "browser",
  pinning: false,
};
