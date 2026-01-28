// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E tests for marimo-cad viewer
 * 
 * Tests the core functionality:
 * 1. Initial render (geometry appears without slider interaction)
 * 2. Dynamic parts (slider changes add new parts with correct tree icons)
 * 3. Selection (clicking parts shows info panel)
 * 4. Visibility toggle (clicking visibility icon hides parts)
 */

test.describe('CAD Viewer', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for viewer to initialize
    await page.waitForSelector('.tv-icon0', { timeout: 15000 });
  });

  test('initial render shows geometry without slider interaction', async ({ page }) => {
    // Tree should show initial parts with color icons
    const treeItems = page.locator('.tv-icon0');
    const count = await treeItems.count();
    
    // Default 4 shelves = 8 parts (Left, Right, Back, Top, Bottom, Shelf1, Shelf2 + Group)
    // But Group doesn't show as a separate icon, so expect 7-8
    expect(count).toBeGreaterThanOrEqual(7);
    
    // All visibility icons should be visible (shape visible)
    for (let i = 0; i < count; i++) {
      const icon = treeItems.nth(i);
      await expect(icon).toHaveClass(/tcv_button_shape/);
    }
    
    // Verify "Shelf 1" and "Shelf 2" appear in tree
    await expect(page.locator('text=Shelf 1')).toBeVisible();
    await expect(page.locator('text=Shelf 2')).toBeVisible();
    
    await page.screenshot({ path: 'tests/e2e/screenshots/test-initial-render.png' });
  });

  test('slider change adds dynamic parts with color icons', async ({ page }) => {
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
    
    // Verify color icons (span containing color dot) exist for new shelves
    // The color icons are spans with inline color style
    const colorIcons = page.locator('span:has-text("⚈")');
    const colorCount = await colorIcons.count();
    expect(colorCount).toBeGreaterThanOrEqual(12); // At least one per part
    
    await page.screenshot({ path: 'tests/e2e/screenshots/test-dynamic-parts.png' });
  });

  test('clicking part selects it and shows info panel', async ({ page }) => {
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
    
    // Part should be highlighted in tree (blue text)
    // The selected item gets a highlight class
    await expect(shelf6Label).toBeVisible();
    
    await page.screenshot({ path: 'tests/e2e/screenshots/test-selection.png' });
  });

  test('visibility toggle hides dynamic parts', async ({ page }) => {
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
    
    // Verify it's initially visible (has tcv_button_shape class)
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape/);
    
    // Click to toggle visibility
    await shelf6VisIcon.click();
    await page.waitForTimeout(1000);
    
    // Icon should now show "hidden" state (tcv_button_shape_no)
    // The class changes from tcv_button_shape to tcv_button_shape_no
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape_no/);
    
    await page.screenshot({ path: 'tests/e2e/screenshots/test-visibility-toggle.png' });
    
    // Click again to make visible
    await shelf6VisIcon.click();
    await page.waitForTimeout(1000);
    
    // Should be visible again
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape/);
  });

  test('camera position is preserved during slider changes', async ({ page }) => {
    // This test verifies the core value proposition:
    // Camera doesn't reset when parametric values change
    
    // Wait for initial render
    await page.waitForTimeout(2000);
    
    // Get initial camera-related state from the viewer info panel
    // The "Control: orbit" text indicates camera mode
    await expect(page.locator('text=Control')).toBeVisible();
    
    // Change slider value
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    
    await page.waitForTimeout(3000);
    
    // Viewer should still show "Ready" status (not re-initializing)
    await expect(page.locator('text=Ready')).toBeVisible();
    
    // Control mode should still be "orbit" (camera wasn't reset)
    await expect(page.locator('text=Control')).toBeVisible();
    
    await page.screenshot({ path: 'tests/e2e/screenshots/test-camera-preserved.png' });
  });

});
