/**
 * Record a demo GIF of marimo-cad
 * Run: node scripts/record-demo.js
 */

const { chromium } = require('@playwright/test');

async function recordDemo() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    recordVideo: {
      dir: './assets/',
      size: { width: 1200, height: 700 }
    }
  });
  
  const page = await context.newPage();
  await page.setViewportSize({ width: 1200, height: 700 });
  
  console.log('Loading page...');
  await page.goto('http://localhost:2718');
  
  // Wait for viewer to initialize
  await page.waitForSelector('.tv-icon0', { timeout: 15000 });
  await page.waitForTimeout(2000);
  
  // Find the canvas for rotation
  const canvas = page.locator('canvas').first();
  const canvasBox = await canvas.boundingBox();
  
  console.log('Rotating model...');
  
  // Rotate the model by dragging on canvas
  const centerX = canvasBox.x + canvasBox.width / 2;
  const centerY = canvasBox.y + canvasBox.height / 2;
  
  // Drag to rotate - smooth rotation (subtle)
  await page.mouse.move(centerX, centerY);
  await page.mouse.down();
  
  // Rotate slowly - just a bit to show custom angle
  for (let i = 0; i < 12; i++) {
    await page.mouse.move(centerX + i * 5, centerY + i * 2);
    await page.waitForTimeout(50);
  }
  await page.mouse.up();
  await page.waitForTimeout(500);
  
  console.log('Changing shelves (camera should stay)...');
  
  // Find the Shelves slider
  const shelvesSlider = page.locator('[role="slider"][aria-valuemin="2"][aria-valuemax="8"]');
  await shelvesSlider.focus();
  
  // Slowly increase shelves - camera should NOT reset!
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(600);
  }
  
  await page.waitForTimeout(800);
  
  // Slowly decrease shelves
  for (let i = 0; i < 4; i++) {
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(600);
  }
  
  await page.waitForTimeout(1000);
  
  console.log('Recording complete, closing...');
  await page.close();
  await context.close();
  await browser.close();
  
  console.log('Video saved to assets/');
  console.log('Convert to GIF with:');
  console.log('  ffmpeg -i assets/*.webm -vf "fps=12,scale=800:-1:flags=lanczos" -loop 0 assets/demo.gif');
}

recordDemo().catch(console.error);
