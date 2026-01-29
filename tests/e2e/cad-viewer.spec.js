// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E tests for marimo-cad viewer
 * 
 * Tests the core functionality with visual regression:
 * 1. Initial render (geometry appears without slider interaction)
 * 2. Dynamic parts (slider changes add new parts with correct tree icons)
 * 3. Selection (clicking parts shows info panel)
 * 4. Visibility toggle (clicking visibility icon hides parts)
 * 5. Camera preservation (camera doesn't reset on updates)
 * 6. Clipping (works on initial and dynamic parts)
 * 
 * Visual snapshots are compared using Playwright's toHaveScreenshot().
 * Update baselines with: npm run test:e2e -- --update-snapshots
 */

// Allow some pixel differences for WebGL rendering variations
const SNAPSHOT_OPTIONS = {
  maxDiffPixels: 500,  // Allow minor rendering differences
  threshold: 0.2,      // Per-pixel color threshold (0-1)
};

test.describe('CAD Viewer', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for viewer to initialize
    await page.waitForSelector('.tv-icon0', { timeout: 15000 });
  });

  test('001 - initial render shows geometry', async ({ page }) => {
    // Tree should show initial parts with color icons
    const treeItems = page.locator('.tv-icon0');
    const count = await treeItems.count();
    
    // Default 4 shelves = 8 parts (Left, Right, Back, Top, Bottom, Shelf1, Shelf2 + Group)
    expect(count).toBeGreaterThanOrEqual(7);
    
    // All visibility icons should be visible (shape visible)
    for (let i = 0; i < count; i++) {
      const icon = treeItems.nth(i);
      await expect(icon).toHaveClass(/tcv_button_shape/);
    }
    
    // Verify "Shelf 1" and "Shelf 2" appear in tree
    await expect(page.locator('text=Shelf 1')).toBeVisible();
    await expect(page.locator('text=Shelf 2')).toBeVisible();
    
    // Visual regression check
    await expect(page).toHaveScreenshot('001-initial-render.png', SNAPSHOT_OPTIONS);
  });

  test('002 - slider adds dynamic parts with icons', async ({ page }) => {
    // Find the Shelves slider (min=2, max=8)
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await expect(shelvesSlider).toBeVisible();
    
    // Get initial value
    const initialValue = await shelvesSlider.getAttribute('aria-valuenow');
    expect(initialValue).toBe('4');
    
    // Increase to 8 shelves using keyboard
    await shelvesSlider.focus();
    await page.keyboard.press('End'); // Jump to max
    
    // Wait for re-render
    await page.waitForTimeout(4000);
    
    // Verify new value
    const newValue = await shelvesSlider.getAttribute('aria-valuenow');
    expect(newValue).toBe('8');
    
    // Verify new shelves appear in tree with color icons
    await expect(page.locator('text=Shelf 3')).toBeVisible();
    await expect(page.locator('text=Shelf 4')).toBeVisible();
    await expect(page.locator('text=Shelf 5')).toBeVisible();
    await expect(page.locator('text=Shelf 6')).toBeVisible();
    
    // All parts should have visibility icons (12 total: 6 structure + 6 shelves)
    const visIcons = page.locator('.tv-icon0');
    const iconCount = await visIcons.count();
    expect(iconCount).toBe(12);
    
    // All icons should show "shape visible" state
    for (let i = 0; i < iconCount; i++) {
      const icon = visIcons.nth(i);
      await expect(icon).toHaveClass(/tcv_button_shape/);
    }
    
    // Verify color icons exist for new shelves
    const colorIcons = page.locator('span:has-text("⚈")');
    const colorCount = await colorIcons.count();
    expect(colorCount).toBeGreaterThanOrEqual(12);
    
    // Visual regression check
    await expect(page).toHaveScreenshot('002-dynamic-parts.png', SNAPSHOT_OPTIONS);
  });

  test('003 - clicking part shows selection', async ({ page }) => {
    // First add more shelves
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(4000);
    
    // Click on "Shelf 6" label to select it
    const shelf6Label = page.locator('text=Shelf 6').first();
    await shelf6Label.click();
    
    await page.waitForTimeout(1000);
    
    // Info panel should show "Name: Shelf 6"
    await expect(page.locator('text=Name: Shelf 6')).toBeVisible({ timeout: 5000 });
    
    // Visual regression check
    await expect(page).toHaveScreenshot('003-selection.png', SNAPSHOT_OPTIONS);
  });

  test('004 - visibility toggle hides parts', async ({ page }) => {
    // First add more shelves
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(4000);
    
    // Get all visibility icons
    const visIcons = page.locator('.tv-icon0');
    const count = await visIcons.count();
    expect(count).toBe(12);
    
    // The last icon is for Shelf 6
    const shelf6VisIcon = visIcons.nth(count - 1);
    
    // Verify it's initially visible
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape/);
    
    // Click to toggle visibility
    await shelf6VisIcon.click();
    await page.waitForTimeout(1000);
    
    // Icon should now show "hidden" state
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape_no/);
    
    // Visual regression check - part should be hidden
    await expect(page).toHaveScreenshot('004-visibility-toggle.png', SNAPSHOT_OPTIONS);
    
    // Click again to make visible
    await shelf6VisIcon.click();
    await page.waitForTimeout(1000);
    
    // Should be visible again
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape/);
  });

  test('005 - camera preserved during updates', async ({ page }) => {
    // Wait for initial render
    await page.waitForTimeout(2000);
    
    // Verify viewer is ready
    await expect(page.locator('text=Control')).toBeVisible();
    
    // Change slider value
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    
    await page.waitForTimeout(3000);
    
    // Viewer should still show "Ready" status
    await expect(page.locator('text=Ready')).toBeVisible();
    
    // Control mode should still be "orbit"
    await expect(page.locator('text=Control')).toBeVisible();
    
    // Visual regression check
    await expect(page).toHaveScreenshot('005-camera-preserved.png', SNAPSHOT_OPTIONS);
  });

  test('006 - clipping works on initial render', async ({ page }) => {
    // Wait for initial render
    await page.waitForTimeout(2000);
    
    // Find and expand clipping section
    const clipSection = page.locator('text=Clip').first();
    if (await clipSection.isVisible()) {
      await clipSection.click();
      await page.waitForTimeout(500);
    }
    
    // Find a clip slider (negative min = bounding box extent)
    const clipSliders = page.locator('input[type="range"]');
    await page.waitForTimeout(1000);
    
    const sliderCount = await clipSliders.count();
    let clipSlider = null;
    
    for (let i = 0; i < sliderCount; i++) {
      const slider = clipSliders.nth(i);
      const min = await slider.getAttribute('min');
      if (min && parseFloat(min) < 0) {
        clipSlider = slider;
        break;
      }
    }
    
    if (clipSlider) {
      const min = parseFloat(await clipSlider.getAttribute('min'));
      const max = parseFloat(await clipSlider.getAttribute('max'));
      const mid = (min + max) / 2;
      
      // Apply clipping
      await clipSlider.fill(mid.toString());
      await page.waitForTimeout(1000);
      
      // Visual regression check - model should be clipped
      await expect(page).toHaveScreenshot('006-clipping-initial.png', SNAPSHOT_OPTIONS);
      
      // Reset clipping
      await clipSlider.fill(max.toString());
      await page.waitForTimeout(500);
    }
    
    // Verify viewer is still responsive
    await expect(page.locator('text=Ready')).toBeVisible();
  });

  test('007 - clipping works on dynamic parts', async ({ page }) => {
    // Wait for initial render
    await page.waitForTimeout(2000);
    
    // Add more shelves (4 -> 8)
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(4000);
    
    // Verify new shelves exist
    await expect(page.locator('text=Shelf 5')).toBeVisible();
    await expect(page.locator('text=Shelf 6')).toBeVisible();
    
    // Find and expand clipping section
    const clipSection = page.locator('text=Clip').first();
    if (await clipSection.isVisible()) {
      await clipSection.click();
      await page.waitForTimeout(500);
    }
    
    // Find a clip slider
    const clipSliders = page.locator('input[type="range"]');
    await page.waitForTimeout(500);
    
    const sliderCount = await clipSliders.count();
    let clipSlider = null;
    
    for (let i = 0; i < sliderCount; i++) {
      const slider = clipSliders.nth(i);
      const min = await slider.getAttribute('min');
      if (min && parseFloat(min) < 0) {
        clipSlider = slider;
        break;
      }
    }
    
    if (clipSlider) {
      const min = parseFloat(await clipSlider.getAttribute('min'));
      const max = parseFloat(await clipSlider.getAttribute('max'));
      const mid = (min + max) / 2;
      
      // Apply clipping to dynamic parts
      await clipSlider.fill(mid.toString());
      await page.waitForTimeout(1000);
      
      // Visual regression check - dynamic parts should also be clipped
      await expect(page).toHaveScreenshot('007-clipping-dynamic.png', SNAPSHOT_OPTIONS);
      
      // Reset clipping
      await clipSlider.fill(max.toString());
      await page.waitForTimeout(500);
    }
    
    // Verify viewer is still responsive
    await expect(page.locator('text=Ready')).toBeVisible();
  });

});
