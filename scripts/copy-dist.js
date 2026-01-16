import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

const distDir = path.join(rootDir, 'dist');
const backendDistDir = path.join(rootDir, 'packages', 'backend', 'dist');
const frontendDistDir = path.join(rootDir, 'packages', 'frontend', 'dist');
const sharedDistDir = path.join(rootDir, 'packages', 'shared', 'dist');

function copyRecursive(src, dest) {
  if (!fs.existsSync(src)) {
    console.error(`Source does not exist: ${src}`);
    return;
  }

  const stats = fs.statSync(src);

  if (stats.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const file of fs.readdirSync(src)) {
      copyRecursive(path.join(src, file), path.join(dest, file));
    }
  } else {
    fs.copyFileSync(src, dest);
  }
}

/**
 * Rewrite @ping/shared imports to relative paths.
 * This is needed because @ping/shared is a workspace package not published to npm.
 */
function rewriteSharedImports(dir, depth = 0) {
  const files = fs.readdirSync(dir);

  for (const file of files) {
    const filePath = path.join(dir, file);
    const stats = fs.statSync(filePath);

    if (stats.isDirectory()) {
      // Don't process shared or frontend directories
      if (file !== 'shared' && file !== 'frontend') {
        rewriteSharedImports(filePath, depth + 1);
      }
    } else if (file.endsWith('.js')) {
      let content = fs.readFileSync(filePath, 'utf-8');

      if (content.includes('@ping/shared')) {
        // Calculate relative path to shared based on depth
        const relativePath = depth === 0 ? './shared/index.js' : '../'.repeat(depth) + 'shared/index.js';
        content = content.replace(/@ping\/shared/g, relativePath);
        fs.writeFileSync(filePath, content);
      }
    }
  }
}

function main() {
  console.log('Copying distribution files...');

  // Clean dist directory
  if (fs.existsSync(distDir)) {
    fs.rmSync(distDir, { recursive: true });
  }
  fs.mkdirSync(distDir, { recursive: true });

  // Copy backend dist (includes cli.js and other server files)
  console.log('Copying backend...');
  copyRecursive(backendDistDir, distDir);

  // Copy frontend dist to dist/frontend
  console.log('Copying frontend...');
  copyRecursive(frontendDistDir, path.join(distDir, 'frontend'));

  // Copy shared dist to dist/shared (in case it's needed)
  console.log('Copying shared...');
  copyRecursive(sharedDistDir, path.join(distDir, 'shared'));

  // Rewrite @ping/shared imports to relative paths
  console.log('Rewriting shared imports...');
  rewriteSharedImports(distDir);

  // Ensure cli.js has shebang and is executable
  const cliPath = path.join(distDir, 'cli.js');
  if (fs.existsSync(cliPath)) {
    let content = fs.readFileSync(cliPath, 'utf-8');
    if (!content.startsWith('#!/usr/bin/env node')) {
      content = '#!/usr/bin/env node\n' + content;
      fs.writeFileSync(cliPath, content);
    }
    fs.chmodSync(cliPath, '755');
    console.log('CLI entry point configured');
  }

  console.log('Done! Distribution files are in ./dist');
}

main();
