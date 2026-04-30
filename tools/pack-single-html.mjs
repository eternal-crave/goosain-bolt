/**
 * Wraps `cocos-creator-single-file-package`: packs a Cocos Creator 3.x web-mobile
 * build into one HTML file, then enforces a max file size (playable / ad limits).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const require = createRequire(import.meta.url);

const DEFAULT_MAX_MIB = 5;
const REDUNDANT_TEX_EXT = new Set(['.astc', '.pkm', '.pvr']);

/** @returns {string | undefined} */
function argValue(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

/** @param {string} dir */
function findLatestWebMobileBuild(dir) {
  const buildRoot = path.join(dir, 'build');
  if (!fs.existsSync(buildRoot)) return undefined;
  const names = fs.readdirSync(buildRoot, { withFileTypes: true });
  const candidates = names
    .filter((d) => d.isDirectory() && d.name.startsWith('web-mobile'))
    .map((d) => path.join(buildRoot, d.name))
    .filter((p) => fs.existsSync(path.join(p, 'index.html')));
  if (candidates.length === 0) return undefined;
  candidates.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
  return path.relative(dir, candidates[0]).replace(/\\/g, '/');
}

/**
 * Drops .astc / .pkm / .pvr next to a .png with the same name (smaller single-file
 * playable; runtime uses PNG where GPU formats were alternatives).
 * @param {string} buildDirAbs
 * @returns {{ removed: number, bytesFreed: number }}
 */
function pruneRedundantNativeTextures(buildDirAbs) {
  let removed = 0;
  let bytesFreed = 0;
  const assetsRoot = path.join(buildDirAbs, 'assets');
  if (!fs.existsSync(assetsRoot)) return { removed, bytesFreed };

  /** @param {string} dir */
  function walk(dir) {
    for (const name of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, name.name);
      if (name.isDirectory()) {
        walk(full);
        continue;
      }
      const ext = path.extname(name.name).toLowerCase();
      if (!REDUNDANT_TEX_EXT.has(ext)) continue;
      const pngPath = path.join(dir, `${path.basename(name.name, ext)}.png`);
      if (!fs.existsSync(pngPath)) continue;
      const st = fs.statSync(full);
      fs.unlinkSync(full);
      removed += 1;
      bytesFreed += st.size;
    }
  }

  walk(assetsRoot);
  return { removed, bytesFreed };
}

function parseMaxBytes(argv) {
  const fromEnv = process.env.PLAYABLE_MAX_BYTES;
  if (fromEnv && /^\d+$/.test(fromEnv.trim())) return parseInt(fromEnv.trim(), 10);
  const fromMb = process.env.PLAYABLE_MAX_MB;
  if (fromMb && /^\d+(\.\d+)?$/.test(fromMb.trim())) {
    return Math.floor(parseFloat(fromMb.trim(), 10) * 1024 * 1024);
  }
  const bytesArg = argValue(argv, '--max-bytes');
  if (bytesArg && /^\d+$/.test(bytesArg)) return parseInt(bytesArg, 10);
  const mbArg = argValue(argv, '--max-mb');
  if (mbArg && /^\d+(\.\d+)?$/.test(mbArg)) return Math.floor(parseFloat(mbArg, 10) * 1024 * 1024);
  return DEFAULT_MAX_MIB * 1024 * 1024;
}

async function main() {
  const argv = process.argv.slice(2);
  const help = argv.includes('-h') || argv.includes('--help');
  if (help) {
    console.log(`
Usage: node tools/pack-single-html.mjs [options]

Pack a Cocos Creator Web Mobile build into one HTML (cocos-creator-single-file-package).

Options:
  --build-dir <path>   Path relative to repo root (default: env CC_BUILD_DIR, or latest build/web-mobile*)
  --output <path>      Output HTML relative to repo root (default: build/single-html/playable.html)
  --max-mb <n>         Max output size in MiB (default: ${DEFAULT_MAX_MIB}; env PLAYABLE_MAX_MB)
  --max-bytes <n>      Max output size in bytes (overrides --max-mb; env PLAYABLE_MAX_BYTES)
  --prune-native       Before pack: delete .astc/.pkm/.pvr when a sibling .png exists (reduces size)
  --no-prune-native    Do not prune (default)

Env:
  CC_BUILD_DIR         Same as --build-dir
  PLAYABLE_MAX_MB      Default max size in MiB
  PLAYABLE_MAX_BYTES   Exact max size in bytes

Flow:
  1. Project → Build → Web Mobile in Cocos Creator (e.g. build/web-mobile-001)
  2. npm run pack:single-html
`);
    process.exit(0);
  }

  const shouldPrune = argv.includes('--prune-native') && !argv.includes('--no-prune-native');

  let buildDir =
    argValue(argv, '--build-dir') ||
    process.env.CC_BUILD_DIR ||
    findLatestWebMobileBuild(root) ||
    'build/web-mobile';

  const outputRel =
    argValue(argv, '--output') ||
    process.env.PLAYABLE_HTML_OUT ||
    'build/single-html/playable.html';

  const maxBytes = parseMaxBytes(argv);
  const buildDirAbs = path.resolve(root, buildDir);

  if (!fs.existsSync(buildDirAbs)) {
    console.error(`\n❌ Build directory not found: ${buildDirAbs}`);
    console.error('   Build Web Mobile in Cocos Creator first, or pass --build-dir path/to/build.');
    process.exit(1);
  }
  if (!fs.existsSync(path.join(buildDirAbs, 'index.html'))) {
    console.error(`\n❌ No index.html in: ${buildDirAbs}`);
    process.exit(1);
  }

  if (shouldPrune) {
    const { removed, bytesFreed } = pruneRedundantNativeTextures(buildDirAbs);
    if (removed > 0) {
      console.log(
        `\n🧹 Prune native: removed ${removed} redundant GPU texture file(s) (~${(bytesFreed / 1024).toFixed(1)} KiB).`
      );
    }
  }

  const outAbs = path.resolve(root, outputRel);
  fs.mkdirSync(path.dirname(outAbs), { recursive: true });

  const { execute } = require('cocos-creator-single-file-package/src/tool/packager.js');

  await execute(root, {
    buildDir,
    outputName: outputRel.replace(/\\/g, '/'),
  });

  const stat = fs.statSync(outAbs);
  const size = stat.size;
  const maxLabel = `${(maxBytes / 1024 / 1024).toFixed(2)} MiB`;
  const sizeLabel = `${(size / 1024 / 1024).toFixed(2)} MiB (${size} bytes)`;

  console.log(`\n📏 Size check (limit ${maxLabel}): output is ${sizeLabel}`);

  if (size > maxBytes) {
    console.error(
      `\n❌ Output exceeds limit (${sizeLabel} > ${maxLabel}).\n` +
        '   In Creator: lower texture max size, use WebP, trim audio, disable unused engine modules.\n' +
        '   Re-run pack with --prune-native to drop .astc/.pkm/.pvr when .png exists beside them.\n'
    );
    process.exit(1);
  }

  console.log('✅ Within size limit.\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
