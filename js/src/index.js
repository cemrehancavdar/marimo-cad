/**
 * marimo-cad widget - anywidget frontend for 3D CAD viewing
 */

import { Display } from "three-cad-viewer";
import { LiveViewer } from "./live-viewer.js";
import "three-cad-viewer/dist/three-cad-viewer.css";
import "./styles.css";

const DEFAULT_RENDER_OPTIONS = {
  ambientIntensity: 1.0,
  directIntensity: 1.1,
  metalness: 0.3,
  roughness: 0.65,
  edgeColor: 0x333333,
  defaultOpacity: 0.5,
  normalLen: 0,
};

const DEFAULT_VIEWER_OPTIONS = {
  up: "Z",
  axes: true,
  axes0: true,
  grid: [true, false, false],
  ortho: true,
  transparent: false,
  blackEdges: true,
  collapse: 1,
};

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

  const treeWidth = 200;
  // three-cad-viewer adds internal padding/borders (~12px total)
  const internalPadding = 12;
  let display = null;
  let viewer = null;
  let resizeTimeout = null;
  let initialized = false;

  function initializeViewer() {
    if (initialized) return;
    
    // Measure actual container width after it's in the DOM
    const measuredWidth = container.getBoundingClientRect().width;
    const totalWidth = measuredWidth > 0 ? Math.floor(measuredWidth) : 800;
    const cadWidth = Math.max(totalWidth - treeWidth - internalPadding, 400);

    const displayOptions = {
      cadWidth: cadWidth,
      height: height,
      treeWidth: treeWidth,
      theme: "browser",
      pinning: false,
    };

    display = new Display(container, displayOptions);
    viewer = new LiveViewer(display, DEFAULT_VIEWER_OPTIONS, (change) => {
      if (change.type === "select") {
        model.set("selected", change.data);
        model.save_changes();
      }
    });
    
    initialized = true;
    renderShapes();
    
    // Set the viewer's internal cadWidth to match display
    // Use setTimeout to ensure three.js renderer is initialized
    setTimeout(() => {
      try {
        viewer.resizeCadView(cadWidth, treeWidth, height, false);
      } catch (e) {
        // Ignore if viewer not ready
      }
    }, 50);
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
      try { viewer.clear(); } catch (e) {}
    }
    viewer.render(shapesData, DEFAULT_RENDER_OPTIONS, DEFAULT_VIEWER_OPTIONS);
  }

  model.on("change:shapes_data", renderShapes);

  // Helper to properly resize the display and viewer
  function resizeDisplay(containerWidth) {
    if (!display || !viewer || !viewer.ready) return;
    
    const newCadWidth = Math.max(Math.floor(containerWidth) - treeWidth - internalPadding, 400);
    try {
      display.setSizes({ 
        cadWidth: newCadWidth, 
        height: height,
        treeWidth: treeWidth 
      });
      viewer.resizeCadView(newCadWidth, treeWidth, height, false);
    } catch (e) {
      // Ignore resize errors
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
        }, 100);
      }
    }
  });
  resizeObserver.observe(container);

  // Fallback: initialize after a short delay if ResizeObserver hasn't fired
  setTimeout(() => {
    if (!initialized) {
      initializeViewer();
    }
  }, 50);

  return () => {
    resizeObserver.disconnect();
    if (resizeTimeout) clearTimeout(resizeTimeout);
    if (viewer) {
      try { viewer.dispose(); } catch(e) {}
    }
    container.innerHTML = "";
  };
}

export default { render };
