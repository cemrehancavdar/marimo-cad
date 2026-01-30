/**
 * CAD Group Factory - Creates real ObjectGroup instances for three-cad-viewer compatibility
 * 
 * This factory creates ObjectGroup instances exactly like NestedGroup.renderShape() does,
 * ensuring full compatibility with:
 * - Clipping (instanceof ObjectGroup check)
 * - NestedGroup._traverse() methods
 * - Selection/highlighting
 * - All material controls (metalness, roughness, opacity, etc.)
 */

import * as THREE from "three";
import { ObjectGroup } from "three-cad-viewer/src/objectgroup.js";
import { LineSegmentsGeometry } from "three/examples/jsm/lines/LineSegmentsGeometry.js";
import { LineMaterial } from "three/examples/jsm/lines/LineMaterial.js";
import { LineSegments2 } from "three/examples/jsm/lines/LineSegments2.js";
import {
  DEFAULT_RENDER_OPTIONS,
  DEFAULT_EDGE_COLOR,
  DEFAULT_PART_COLOR,
  DEFAULT_PART_STATE,
  DEFAULT_PART_ALPHA,
  FALLBACK_WIDTH,
} from "./constants.js";

/** Default height for line material resolution */
const DEFAULT_HEIGHT = 600;

/**
 * Create edges mesh from edge data
 * @param {Float32Array|Array} edgeData - Edge positions
 * @param {Object} options - Render options
 * @param {Array} state - Visibility state [shapeVis, edgeVis]
 * @returns {LineSegments2}
 */
function createEdges(edgeData, options, state) {
  const positions = edgeData instanceof Float32Array
    ? edgeData
    : new Float32Array(edgeData);

  const lineGeometry = new LineSegmentsGeometry();
  lineGeometry.setPositions(positions);

  const edgeColor = options.edgeColor ?? DEFAULT_EDGE_COLOR;
  const lineMaterial = new LineMaterial({
    color: new THREE.Color(edgeColor),
    linewidth: 1,
    transparent: true,
    depthWrite: !options.transparent,
    depthTest: !options.transparent,
    clipIntersection: false,
  });
  lineMaterial.visible = state[1] === 1;
  lineMaterial.resolution.set(options.width || FALLBACK_WIDTH, options.height || DEFAULT_HEIGHT);

  const edges = new LineSegments2(lineGeometry, lineMaterial);
  edges.renderOrder = 999;

  return edges;
}

/**
 * Create a real ObjectGroup instance for a CAD part.
 * Matches NestedGroup.renderShape() implementation exactly.
 * 
 * @param {Object} partData - Part data from Python
 * @param {string} partData.id - Part ID (path like "/Group/PartName")
 * @param {string} partData.name - Display name
 * @param {Object} partData.shape - Shape data with vertices, normals, triangles, edges
 * @param {string|number} partData.color - Part color
 * @param {number} partData.alpha - Opacity (0-1)
 * @param {Array} partData.loc - Transform [[x,y,z], [qx,qy,qz,qw]]
 * @param {Array} partData.state - Visibility state [shapeVis, edgeVis]
 * @param {Object} options - Render options
 * @returns {ObjectGroup}
 */
export function createCADGroup(partData, options = {}) {
  const opts = { ...DEFAULT_RENDER_OPTIONS, width: FALLBACK_WIDTH, height: DEFAULT_HEIGHT, ...options };
  const { id, name, shape, color, alpha, state } = partData;
  
  const partColor = new THREE.Color(color || DEFAULT_PART_COLOR);
  const partAlpha = alpha ?? DEFAULT_PART_ALPHA;
  const partState = state || DEFAULT_PART_STATE;
  const renderback = true;

  // Create ObjectGroup exactly like NestedGroup.renderShape()
  const group = new ObjectGroup(
    opts.defaultOpacity,    // opacity
    partAlpha,              // alpha
    opts.edgeColor,         // edge_color
    { topo: "face" },       // shapeInfo (geomtype)
    "solid",                // subtype - CRITICAL for clipping check
    renderback              // renderback
  );

  group.name = id.replaceAll("/", "|");

  // Create geometry
  const positions = shape.vertices instanceof Float32Array
    ? shape.vertices
    : new Float32Array(shape.vertices);
  const normals = shape.normals instanceof Float32Array
    ? shape.normals
    : new Float32Array(shape.normals);
  const triangles = shape.triangles instanceof Uint32Array
    ? shape.triangles
    : new Uint32Array(shape.triangles);

  const shapeGeometry = new THREE.BufferGeometry();
  shapeGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  shapeGeometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3));
  shapeGeometry.setIndex(new THREE.BufferAttribute(triangles, 1));
  shapeGeometry.computeBoundingBox();
  shapeGeometry.computeBoundingSphere();

  // Store geometry on group (required for clipping)
  group.shapeGeometry = shapeGeometry;

  // Determine if transparent
  const isTransparent = opts.transparent || partAlpha < 1.0;

  // Create front material (MeshStandardMaterial like NestedGroup)
  const frontMaterial = new THREE.MeshStandardMaterial({
    color: partColor,
    metalness: opts.metalness,
    roughness: opts.roughness,
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 1.0,
    transparent: true,
    opacity: isTransparent ? opts.defaultOpacity * partAlpha : partAlpha,
    depthWrite: !isTransparent,
    depthTest: true,
    clipIntersection: false,
    side: THREE.FrontSide,
    visible: partState[0] === 1,
    name: "frontMaterial",
  });

  // Create back material (MeshBasicMaterial like NestedGroup)
  const backMaterial = new THREE.MeshBasicMaterial({
    color: partColor,
    side: THREE.BackSide,
    polygonOffset: true,
    polygonOffsetFactor: 1.0,
    polygonOffsetUnits: 1.0,
    transparent: true,
    opacity: isTransparent ? opts.defaultOpacity * partAlpha : partAlpha,
    depthWrite: !isTransparent,
    depthTest: true,
    clipIntersection: false,
    visible: partState[0] === 1 && renderback,
    name: "backMaterial",
  });

  // Create meshes
  const back = new THREE.Mesh(shapeGeometry, backMaterial);
  back.name = name || id;

  const front = new THREE.Mesh(shapeGeometry, frontMaterial);
  front.name = name || id;

  // Ensure transparent objects render last
  if (partAlpha < 1.0) {
    back.renderOrder = 999;
    front.renderOrder = 999;
  }

  // Add meshes via addType (this sets up originalColor, etc.)
  group.addType(back, "back");
  group.addType(front, "front");

  // Create edges if provided
  if (shape.edges?.length > 0) {
    const edges = createEdges(shape.edges, opts, partState);
    edges.name = name || id;
    group.addType(edges, "edges");
  }

  return group;
}

/**
 * Update render options with display dimensions
 * @param {Object} options - Existing options
 * @param {Object} display - Display object with cadWidth and height
 * @returns {Object} - Updated options
 */
export function updateOptionsFromDisplay(options, display) {
  if (!display) return options;
  return {
    ...options,
    width: display.cadWidth || options.width,
    height: display.height || options.height,
  };
}
