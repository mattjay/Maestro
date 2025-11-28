#!/usr/bin/env node
/**
 * Generate PWA icons from the source icon.png
 *
 * This script creates all the necessary icon sizes for the PWA manifest.
 * Run with: node scripts/generate-pwa-icons.mjs
 *
 * Requires: sharp (npm install --save-dev sharp)
 *
 * If sharp is not available, it falls back to copying the source icon
 * and the PWA will use whatever size is available.
 */

import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '..');

const SOURCE_ICON = path.join(rootDir, 'build', 'icon.png');
const OUTPUT_DIR = path.join(rootDir, 'src', 'web', 'public', 'icons');

const ICON_SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

async function main() {
  console.log('Generating PWA icons...');

  // Ensure output directory exists
  await fs.mkdir(OUTPUT_DIR, { recursive: true });

  // Check if source icon exists
  try {
    await fs.access(SOURCE_ICON);
  } catch {
    console.error(`Source icon not found: ${SOURCE_ICON}`);
    console.log('Creating placeholder icons instead...');
    await createPlaceholderIcons();
    return;
  }

  // Try to use sharp for resizing
  let sharp;
  try {
    sharp = (await import('sharp')).default;
  } catch {
    console.log('sharp not installed. To enable proper icon generation:');
    console.log('  npm install --save-dev sharp');
    console.log('');
    console.log('Copying source icon as fallback...');
    await copySourceIcon();
    return;
  }

  // Generate icons at each size
  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    try {
      await sharp(SOURCE_ICON)
        .resize(size, size, {
          fit: 'contain',
          background: { r: 26, g: 26, b: 46, alpha: 1 } // #1a1a2e
        })
        .png()
        .toFile(outputPath);
      console.log(`  Created: icon-${size}x${size}.png`);
    } catch (err) {
      console.error(`  Failed to create icon-${size}x${size}.png:`, err.message);
    }
  }

  console.log('Done!');
}

async function copySourceIcon() {
  // Copy the source icon to each size location
  const sourceBuffer = await fs.readFile(SOURCE_ICON);
  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.png`);
    await fs.writeFile(outputPath, sourceBuffer);
    console.log(`  Copied: icon-${size}x${size}.png (not resized)`);
  }
  console.log('');
  console.log('Note: Icons were copied but not resized.');
  console.log('Install sharp for proper icon generation: npm install --save-dev sharp');
}

async function createPlaceholderIcons() {
  // Create a simple SVG placeholder and convert to PNG-like format
  // This creates a minimal valid PNG for each size
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
    <rect width="512" height="512" fill="#1a1a2e"/>
    <text x="256" y="280" font-family="system-ui, sans-serif" font-size="200"
          font-weight="bold" fill="#4a9eff" text-anchor="middle">M</text>
  </svg>`;

  for (const size of ICON_SIZES) {
    const outputPath = path.join(OUTPUT_DIR, `icon-${size}x${size}.svg`);
    await fs.writeFile(outputPath, svg);
    console.log(`  Created placeholder: icon-${size}x${size}.svg`);
  }

  // Also update manifest to use SVG
  console.log('');
  console.log('Note: Created SVG placeholders. Run with source icon for PNG output.');
}

main().catch(console.error);
