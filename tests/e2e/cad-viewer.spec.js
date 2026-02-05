// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * E2E tests for marimo-cad viewer
 * 
 * Tests core functionality with camera rotation applied before each test.
 * This ensures camera position is preserved through all operations.
 * 
 * Visual snapshots are compared using Playwright's toHaveScreenshot().
 * Update baselines with: npm run test:e2e -- --update-snapshots
 */

// Allow some pixel differences for WebGL rendering variations
const SNAPSHOT_OPTIONS = {
  maxDiffPixels: 500,
  threshold: 0.2,
};

/**
 * Rotate the camera by dragging on the canvas.
 * @param {import('@playwright/test').Page} page
 * @param {number} deltaX - Horizontal drag distance
 * @param {number} deltaY - Vertical drag distance
 */
async function rotateCamera(page, deltaX = 100, deltaY = 50) {
  const canvas = page.locator('canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas not found');
  
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  
  // Perform drag to rotate (left mouse button for orbit)
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  await page.mouse.move(centerX + deltaX, centerY + deltaY, { steps: 10 });
  await page.mouse.up();
  
  // Let the render settle
  await page.waitForTimeout(500);
}

test.describe('CAD Viewer with Rotation', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for viewer canvas to initialize
    await page.waitForSelector('canvas', { timeout: 15000 });
    // Wait for tree to populate
    await page.waitForSelector('.tv-icon0', { timeout: 15000 });
    // Give initial render time to complete
    await page.waitForTimeout(1000);
    
    // Rotate camera horizontally to a non-default angle
    // This rotation should be preserved through all subsequent operations
    await rotateCamera(page, 40, 0);
  });

  test('001 - initial render with rotation shows geometry', async ({ page }) => {
    // Tree should show initial parts
    const treeItems = page.locator('.tv-icon0');
    const count = await treeItems.count();
    
    // Default 4 shelves = 7+ parts
    expect(count).toBeGreaterThanOrEqual(7);
    
    // All visibility icons should be visible
    for (let i = 0; i < count; i++) {
      const icon = treeItems.nth(i);
      await expect(icon).toHaveClass(/tcv_button_shape/);
    }
    
    // Verify shelves appear in tree
    await expect(page.locator('text=Shelf 1')).toBeVisible();
    await expect(page.locator('text=Shelf 2')).toBeVisible();
    
    // Visual check - rotated view
    await expect(page).toHaveScreenshot('001-rotated-initial.png', SNAPSHOT_OPTIONS);
  });

  test('002 - dynamic parts preserve rotation', async ({ page }) => {
    // Find the Shelves slider
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await expect(shelvesSlider).toBeVisible();
    
    // Verify initial value
    const initialValue = await shelvesSlider.getAttribute('aria-valuenow');
    expect(initialValue).toBe('4');
    
    // Increase to 8 shelves
    await shelvesSlider.focus();
    await page.keyboard.press('End');
    
    // Wait for re-render
    await page.waitForTimeout(3000);
    
    // Verify new value
    const newValue = await shelvesSlider.getAttribute('aria-valuenow');
    expect(newValue).toBe('8');
    
    // Verify new shelves appear
    await expect(page.locator('text=Shelf 3')).toBeVisible();
    await expect(page.locator('text=Shelf 4')).toBeVisible();
    await expect(page.locator('text=Shelf 5')).toBeVisible();
    await expect(page.locator('text=Shelf 6')).toBeVisible();
    
    // All parts should have visibility icons
    const visIcons = page.locator('.tv-icon0');
    const iconCount = await visIcons.count();
    expect(iconCount).toBeGreaterThanOrEqual(11);
    
    // Visual check - rotation should be preserved after adding parts
    await expect(page).toHaveScreenshot('002-rotated-dynamic.png', SNAPSHOT_OPTIONS);
  });

  test('003 - selection preserves rotation', async ({ page }) => {
    // Add more shelves
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(3000);
    
    // Click on "Shelf 6" to select it
    const shelf6Label = page.locator('text=Shelf 6').first();
    await shelf6Label.click();
    await page.waitForTimeout(1000);
    
    // Info panel should show selection
    await expect(page.locator('text=Name: Shelf 6')).toBeVisible({ timeout: 5000 });
    
    // Visual check - rotation preserved, selection visible
    await expect(page).toHaveScreenshot('003-rotated-selection.png', SNAPSHOT_OPTIONS);
  });

  test('004 - visibility toggle preserves rotation', async ({ page }) => {
    // Add more shelves
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(3000);
    
    // Get visibility icons
    const visIcons = page.locator('.tv-icon0');
    const count = await visIcons.count();
    expect(count).toBeGreaterThanOrEqual(11);
    
    // Last icon is Shelf 6
    const shelf6VisIcon = visIcons.nth(count - 1);
    
    // Verify initially visible
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape/);
    
    // Toggle visibility off
    await shelf6VisIcon.click();
    await page.waitForTimeout(500);
    
    // Should be hidden
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape_no/);
    
    // Visual check - rotation preserved, part hidden
    await expect(page).toHaveScreenshot('004-rotated-visibility.png', SNAPSHOT_OPTIONS);
    
    // Toggle back on
    await shelf6VisIcon.click();
    await page.waitForTimeout(500);
    await expect(shelf6VisIcon).toHaveClass(/tcv_button_shape/);
  });

  test('005 - slider changes preserve rotation', async ({ page }) => {
    // Verify viewer ready
    await expect(page.locator('text=Control')).toBeVisible();
    
    // Change slider incrementally
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(1500);
    
    // Viewer should still be ready
    await expect(page.locator('text=Ready')).toBeVisible();
    
    // Visual check - rotation preserved through incremental updates
    await expect(page).toHaveScreenshot('005-rotated-incremental.png', SNAPSHOT_OPTIONS);
  });

  test('006 - clipping preserves rotation', async ({ page }) => {
    // Expand clipping section
    const clipSection = page.locator('text=Clip').first();
    if (await clipSection.isVisible()) {
      await clipSection.click();
      await page.waitForTimeout(500);
    }
    
    // Find clip slider (has negative min value)
    const clipSliders = page.locator('input[type="range"]');
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
    
    expect(clipSlider).not.toBeNull();
    
    if (clipSlider) {
      // Set clip slider to 0 via JavaScript
      await clipSlider.evaluate(el => {
        el.value = 0;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
      await page.waitForTimeout(1000);
      
      // Visual check - rotation preserved with clipping
      await expect(page).toHaveScreenshot('006-rotated-clipping.png', SNAPSHOT_OPTIONS);
      
      // Reset to max
      await clipSlider.evaluate(el => {
        el.value = el.max;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
    }
    
    await expect(page.locator('text=Ready')).toBeVisible();
  });

  test('007 - clipping on dynamic parts preserves rotation', async ({ page }) => {
    // Add more shelves
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(3000);
    
    // Verify new shelves
    await expect(page.locator('text=Shelf 5')).toBeVisible();
    await expect(page.locator('text=Shelf 6')).toBeVisible();
    
    // Expand clipping
    const clipSection = page.locator('text=Clip').first();
    if (await clipSection.isVisible()) {
      await clipSection.click();
      await page.waitForTimeout(500);
    }
    
    // Find clip slider
    const clipSliders = page.locator('input[type="range"]');
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
    
    expect(clipSlider).not.toBeNull();
    
    if (clipSlider) {
      // Set clip slider to 0 via JavaScript
      await clipSlider.evaluate(el => {
        el.value = 0;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
      await page.waitForTimeout(1000);
      
      // Visual check - rotation preserved with dynamic parts clipped
      await expect(page).toHaveScreenshot('007-rotated-dynamic-clipping.png', SNAPSHOT_OPTIONS);
      
      // Reset to max
      await clipSlider.evaluate(el => {
        el.value = el.max;
        el.dispatchEvent(new InputEvent('input', { bubbles: true }));
      });
    }
    
    await expect(page.locator('text=Ready')).toBeVisible();
  });

  test('008 - visibility persists for permanent parts across slider changes', async ({ page }) => {
    // Get visibility icons for Left Side, Right Side, Back (indices 1, 2, 3 after Group)
    const visIcons = page.locator('.tv-icon0');
    
    // Hide Left Side, Right Side, Back panels
    const leftSideIcon = visIcons.nth(1);
    const rightSideIcon = visIcons.nth(2);
    const backIcon = visIcons.nth(3);
    
    await leftSideIcon.click();
    await page.waitForTimeout(300);
    await rightSideIcon.click();
    await page.waitForTimeout(300);
    await backIcon.click();
    await page.waitForTimeout(300);
    
    // Verify they are hidden
    await expect(leftSideIcon).toHaveClass(/tcv_button_shape_no/);
    await expect(rightSideIcon).toHaveClass(/tcv_button_shape_no/);
    await expect(backIcon).toHaveClass(/tcv_button_shape_no/);
    
    // Change shelves slider (add shelves)
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(2000);
    
    // Verify panels are still hidden after slider change
    const visIconsAfter = page.locator('.tv-icon0');
    const leftSideIconAfter = visIconsAfter.nth(1);
    const rightSideIconAfter = visIconsAfter.nth(2);
    const backIconAfter = visIconsAfter.nth(3);
    
    await expect(leftSideIconAfter).toHaveClass(/tcv_button_shape_no/);
    await expect(rightSideIconAfter).toHaveClass(/tcv_button_shape_no/);
    await expect(backIconAfter).toHaveClass(/tcv_button_shape_no/);
    
    // Decrease shelves
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(2000);
    
    // Verify panels are still hidden
    const visIconsFinal = page.locator('.tv-icon0');
    await expect(visIconsFinal.nth(1)).toHaveClass(/tcv_button_shape_no/);
    await expect(visIconsFinal.nth(2)).toHaveClass(/tcv_button_shape_no/);
    await expect(visIconsFinal.nth(3)).toHaveClass(/tcv_button_shape_no/);
  });

  test('009 - visibility resets for removed and re-added parts', async ({ page }) => {
    // Start with max shelves (8)
    const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
    await shelvesSlider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(2000);
    
    // Verify Shelf 6 exists
    await expect(page.locator('text=Shelf 6')).toBeVisible();
    
    // Get all visibility icons - last one is Shelf 6
    const visIcons = page.locator('.tv-icon0');
    const count = await visIcons.count();
    const shelf6Icon = visIcons.nth(count - 1);
    
    // Hide Shelf 6
    await shelf6Icon.click();
    await page.waitForTimeout(500);
    
    // Verify it's hidden
    await expect(shelf6Icon).toHaveClass(/tcv_button_shape_no/);
    
    // Decrease to 2 shelves (removes Shelf 3-6)
    await shelvesSlider.focus();
    await page.keyboard.press('Home');
    await page.waitForTimeout(2000);
    
    // Verify Shelf 6 is gone
    await expect(page.locator('text=Shelf 6')).not.toBeVisible();
    
    // Increase back to max shelves (8)
    await page.keyboard.press('End');
    await page.waitForTimeout(2000);
    
    // Verify Shelf 6 is back
    await expect(page.locator('text=Shelf 6')).toBeVisible();
    
    // Get icons again - last one should be Shelf 6, now VISIBLE
    const visIconsAfter = page.locator('.tv-icon0');
    const countAfter = await visIconsAfter.count();
    const shelf6IconAfter = visIconsAfter.nth(countAfter - 1);
    
    // Should be visible (tcv_button_shape without _no suffix)
    await expect(shelf6IconAfter).not.toHaveClass(/tcv_button_shape_no/);
  });

  test('010 - resize object fits view after height change', async ({ page }) => {
    // Increase height slider to max (object gets taller)
    // Height slider: min=60, max=200
    const heightSlider = page.locator('[role="slider"][aria-valuemin="60"][aria-valuemax="200"]');
    await expect(heightSlider).toBeVisible();
    await heightSlider.focus();
    await page.keyboard.press('End');
    await page.waitForTimeout(2000);
    
    // Click "Resize object" button (tooltip wrapper contains the button)
    const resizeButton = page.locator('.tcv_tooltip:has-text("Resize object") input.tcv_btn').first();
    if (await resizeButton.count() === 0) {
      // Fallback: try finding by data-tooltip attribute
      const resizeWrapper = page.locator('[data-base-tooltip="Resize object"]');
      await resizeWrapper.click();
    } else {
      await resizeButton.click();
    }
    await page.waitForTimeout(1000);
    
    // Visual check - object should fit in view after resize
    await expect(page).toHaveScreenshot('010-after-resize.png', SNAPSHOT_OPTIONS);
    
    // Verify viewer is still functional
    await expect(page.locator('text=Ready')).toBeVisible();
  });

});
