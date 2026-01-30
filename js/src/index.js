/**
 * marimo-cad widget - anywidget frontend for 3D CAD viewing
 */

import { Display } from "three-cad-viewer";
import { LiveViewer } from "./live-viewer.js";
import {
  DEFAULT_RENDER_OPTIONS,
  DEFAULT_VIEWER_OPTIONS,
  DEFAULT_DISPLAY_OPTIONS,
  TREE_WIDTH,
  INTERNAL_PADDING,
  MIN_CAD_WIDTH,
  FALLBACK_WIDTH,
  RESIZE_DEBOUNCE_MS,
} from "./constants.js";
import "three-cad-viewer/dist/three-cad-viewer.css";
import "./styles.css";

export function render({ model, el }) {
  const widthRaw = model.get("width") || "100%";
  const height = model.get("height") || 600;
  
  // Width can be CSS string ("100%", "800px") or number
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

  function initializeViewer() {
    if (initialized) return;
    
    // Measure actual container width after it's in the DOM
    const measuredWidth = container.getBoundingClientRect().width;
    const totalWidth = measuredWidth > 0 ? Math.floor(measuredWidth) : FALLBACK_WIDTH;
    const cadWidth = Math.max(totalWidth - TREE_WIDTH - INTERNAL_PADDING, MIN_CAD_WIDTH);

    const displayOptions = {
      ...DEFAULT_DISPLAY_OPTIONS,
      cadWidth: cadWidth,
      height: height,
      treeWidth: TREE_WIDTH,
    };

    display = new Display(container, displayOptions);
    viewer = new LiveViewer(display, DEFAULT_VIEWER_OPTIONS, (change) => {
      if (change.type === "select") {
        model.set("selected", change.data);
        model.save_changes();
      }
    });
    
    initialized = true;
    
    // Signal to Python that JS is ready to receive data
    model.send({ type: "ready" });
    
    // Try to render any data that's already available
    renderShapes();
    
    // Set the viewer's internal cadWidth to match display after first render frame
    // Using requestAnimationFrame ensures three.js renderer is initialized
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

  function renderShapes() {
    if (!viewer) return;
    
    const shapesData = model.get("shapes_data");
    
    // Skip empty data
    if (!shapesData || !shapesData.parts || shapesData.parts.length === 0) {
      return;
    }

    // If viewer ready, use syncParts (geometry-only update, preserves camera/UI)
    if (viewer.ready && viewer.syncParts) {
      if (viewer.syncParts(shapesData)) {
        return; // Success - only geometries updated
      }
    }

    // First render or syncParts not available - full render needed
    if (viewer.nestedGroup) {
      try { viewer.clear(); } catch (e) {
        console.warn('[marimo-cad] Failed to clear viewer:', e.message);
      }
    }
    viewer.render(shapesData, DEFAULT_RENDER_OPTIONS, DEFAULT_VIEWER_OPTIONS);
  }

  model.on("change:shapes_data", renderShapes);

  // Helper to properly resize the display and viewer
  function resizeDisplay(containerWidth) {
    if (!display || !viewer || !viewer.ready) return;
    
    const newCadWidth = Math.max(Math.floor(containerWidth) - TREE_WIDTH - INTERNAL_PADDING, MIN_CAD_WIDTH);
    try {
      display.setSizes({ 
        cadWidth: newCadWidth, 
        height: height,
        treeWidth: TREE_WIDTH,
      });
      viewer.resizeCadView(newCadWidth, TREE_WIDTH, height, false);
    } catch (e) {
      console.warn('[marimo-cad] Resize failed:', e.message);
    }
  }

  // Handle container resizes (for responsive width like "100%")
  const resizeObserver = new ResizeObserver((entries) => {
    const newWidth = entries[0].contentRect.width;
    if (newWidth > 0) {
      if (!initialized) {
        // First resize - initialize with correct width
        initializeViewer();
      } else {
        // Subsequent resizes - debounce
        if (resizeTimeout) clearTimeout(resizeTimeout);
        resizeTimeout = setTimeout(() => {
          resizeDisplay(newWidth);
        }, RESIZE_DEBOUNCE_MS);
      }
    }
  });
  resizeObserver.observe(container);

  // Fallback: initialize after animation frame if ResizeObserver hasn't fired
  // This handles edge cases where container has fixed width (no resize event)
  requestAnimationFrame(() => {
    if (!initialized) {
      initializeViewer();
    }
  });

  return () => {
    resizeObserver.disconnect();
    if (resizeTimeout) clearTimeout(resizeTimeout);
    if (viewer) {
      try { viewer.dispose(); } catch(e) {
        console.warn('[marimo-cad] Dispose failed:', e.message);
      }
    }
    container.innerHTML = "";
  };
}

export default { render };
