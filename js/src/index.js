/**
 * marimo-cad widget - anywidget frontend for 3D CAD viewing
 * 
 * Uses three-cad-viewer v4.1 batched API for reactive updates:
 * - skipBounds defers bounds recalculation
 * - updateBounds() called once after batch
 * - Camera preserved across updates
 * 
 * See: https://github.com/bernhard-42/three-cad-viewer/issues/36
 */

import { Display, Viewer } from "three-cad-viewer";
import {
  DEFAULT_RENDER_OPTIONS,
  DEFAULT_VIEWER_OPTIONS,
  DEFAULT_DISPLAY_OPTIONS,
  COLLAPSE_MODE,
  TREE_WIDTH,
  INTERNAL_PADDING,
  MIN_CAD_WIDTH,
  FALLBACK_WIDTH,
  RESIZE_DEBOUNCE_MS,
} from "./constants.js";
import "three-cad-viewer/css";
import "./styles.css";

export function render({ model, el }) {
  const widthRaw = model.get("width") || "100%";
  const height = model.get("height") || 600;
  const widthCSS = typeof widthRaw === "number" ? `${widthRaw}px` : widthRaw;
  
  const container = document.createElement("div");
  container.className = "marimo-cad-container";
  container.style.width = widthCSS;
  container.style.height = height + "px";
  el.appendChild(container);

  let display = null;
  let viewer = null;
  let resizeTimeout = null;
  let initialized = false;
  
  // Part tracking for batched updates
  let currentPartNames = new Set();
  let parentPath = "/Group";
  
  function initializeViewer() {
    if (initialized) return;
    
    const measuredWidth = container.getBoundingClientRect().width;
    const totalWidth = measuredWidth > 0 ? Math.floor(measuredWidth) : FALLBACK_WIDTH;
    const cadWidth = Math.max(totalWidth - TREE_WIDTH - INTERNAL_PADDING, MIN_CAD_WIDTH);

    display = new Display(container, {
      ...DEFAULT_DISPLAY_OPTIONS,
      cadWidth,
      height,
      treeWidth: TREE_WIDTH,
    });
    
    viewer = new Viewer(display, DEFAULT_VIEWER_OPTIONS, (change) => {
      if (change.type === "select") {
        model.set("selected", change.data);
        model.save_changes();
      }
    });
    
    initialized = true;
    model.send({ type: "ready" });
    renderShapes();
    
    requestAnimationFrame(() => {
      if (viewer.ready) {
        try {
          viewer.resizeCadView(cadWidth, TREE_WIDTH, height, false);
        } catch (e) {
          console.warn('[marimo-cad] Initial resize failed:', e.message);
        }
      }
    });
  }

  /**
   * Sync parts using batched remove+add.
   * TCV v4.1+ preserves visibility and camera distance internally.
   * Returns true if sync succeeded, false if full render needed.
   */
  function syncParts(shapesData) {
    if (!viewer.ready || !shapesData?.parts) return false;

    const newParentPath = shapesData.id || parentPath;
    const newPartNames = new Set(shapesData.parts.map(p => p.name));

    // Phase 1: Remove deleted parts
    for (const name of currentPartNames) {
      if (!newPartNames.has(name)) {
        try {
          viewer.removePart(`${newParentPath}/${name}`, { skipBounds: true });
        } catch (e) { /* already removed */ }
      }
    }

    // Phase 2: Update (remove+add) or add parts
    for (const part of shapesData.parts) {
      const path = `${newParentPath}/${part.name}`;
      try {
        if (currentPartNames.has(part.name)) {
          viewer.removePart(path, { skipBounds: true });
        }
        viewer.addPart(newParentPath, part, { skipBounds: true });
      } catch (e) {
        console.warn(`[marimo-cad] Failed to sync part ${part.name}:`, e.message);
      }
    }

    // Phase 3: Finalize (TCV preserves visibility internally)
    viewer.updateBounds();
    currentPartNames = newPartNames;
    parentPath = newParentPath;
    viewer.collapseNodes(COLLAPSE_MODE.EXPAND_ALL);
    
    return true;
  }

  function renderShapes() {
    if (!viewer) return;
    
    const shapesData = model.get("shapes_data");
    if (!shapesData?.parts?.length) return;

    // Try sync first (preserves camera)
    if (viewer.ready && syncParts(shapesData)) return;

    // Initial render
    viewer.render(shapesData, DEFAULT_RENDER_OPTIONS, DEFAULT_VIEWER_OPTIONS);
    currentPartNames.clear();
    parentPath = shapesData.id || "/Group";
    for (const part of shapesData.parts) {
      currentPartNames.add(part.name);
    }
    viewer.collapseNodes(COLLAPSE_MODE.EXPAND_ALL);
  }

  model.on("change:shapes_data", renderShapes);

  function resizeDisplay(containerWidth) {
    if (!display || !viewer?.ready) return;
    const newCadWidth = Math.max(Math.floor(containerWidth) - TREE_WIDTH - INTERNAL_PADDING, MIN_CAD_WIDTH);
    try {
      display.setSizes({ cadWidth: newCadWidth, height, treeWidth: TREE_WIDTH });
      viewer.resizeCadView(newCadWidth, TREE_WIDTH, height, false);
    } catch (e) {
      console.warn('[marimo-cad] Resize failed:', e.message);
    }
  }

  const resizeObserver = new ResizeObserver((entries) => {
    const newWidth = entries[0].contentRect.width;
    if (newWidth > 0) {
      if (!initialized) {
        initializeViewer();
      } else {
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => resizeDisplay(newWidth), RESIZE_DEBOUNCE_MS);
      }
    }
  });
  resizeObserver.observe(container);

  requestAnimationFrame(() => {
    if (!initialized) initializeViewer();
  });

  return () => {
    resizeObserver.disconnect();
    if (resizeTimeout) clearTimeout(resizeTimeout);
    if (viewer) {
      try { viewer.dispose(); } catch(e) { /* ignore */ }
    }
    container.innerHTML = "";
  };
}

export default { render };
