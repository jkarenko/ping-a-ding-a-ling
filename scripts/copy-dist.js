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
