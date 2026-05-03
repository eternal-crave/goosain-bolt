/**
 * Deploys the packed playable HTML to the gh-pages branch via a git worktree.
 *
 * Using a worktree means the current branch is never touched — no stash,
 * no checkout, no lost work.
 *
 * Usage:
 *   node tools/deploy-gh-pages.mjs [options]
 *
 * Options:
 *   --input <path>    Source HTML file (default: build/single-html/playable.html,
 *                     fallback: index.html at repo root)
 *   --message <msg>   Git commit message (default: "chore: update playable")
 *   --dry-run         Show what would happen without pushing or committing
 *   -h, --help        Print this help
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import os from 'node:os';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** @returns {string | undefined} */
function argValue(argv, name) {
  const i = argv.indexOf(name);
  if (i === -1 || i + 1 >= argv.length) return undefined;
  return argv[i + 1];
}

/**
 * Runs a git command, printing it first, and returns trimmed stdout.
 * @param {string[]} args
 * @param {{ cwd?: string, dryRun?: boolean }} [opts]
 * @returns {string}
 */
function git(args, { cwd = root, dryRun = false } = {}) {
  const displayCwd = path.relative(root, cwd) || '.';
  console.log(`   git ${args.join(' ')}  [cwd: ${displayCwd}]`);
  if (dryRun) return '';
  return execFileSync('git', args, { cwd, encoding: 'utf-8' }).trim();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const argv = process.argv.slice(2);

  if (argv.includes('-h') || argv.includes('--help')) {
    console.log(`
Usage: node tools/deploy-gh-pages.mjs [options]

Deploy the packed playable HTML to the gh-pages branch.

Options:
  --input <path>    Source HTML file
                    (default: build/single-html/playable.html,
                     fallback: index.html at repo root)
  --message <msg>   Git commit message (default: "chore: update playable")
  --dry-run         Print commands without executing git writes or push
  -h, --help        Show this help

Examples:
  node tools/deploy-gh-pages.mjs
  node tools/deploy-gh-pages.mjs --input build/single-html/playable.html
  node tools/deploy-gh-pages.mjs --dry-run
`);
    process.exit(0);
  }

  const dryRun = argv.includes('--dry-run');
  const commitMessage = argValue(argv, '--message') ?? 'chore: update playable';

  // -------------------------------------------------------------------------
  // Resolve source file
  // -------------------------------------------------------------------------
  let inputFile = argValue(argv, '--input');

  if (!inputFile) {
    const packOutput = path.join(root, 'build', 'single-html', 'playable.html');
    const repoRoot = path.join(root, 'index.html');

    if (fs.existsSync(packOutput)) {
      inputFile = packOutput;
      console.log(`\n📄 Source: ${path.relative(root, packOutput)} (pack output)`);
    } else if (fs.existsSync(repoRoot)) {
      inputFile = repoRoot;
      console.log(`\n📄 Source: index.html (repo root fallback — no pack output found)`);
    } else {
      console.error('\n❌ No source file found.');
      console.error('   Run npm run pack:single-html first, or pass --input <path>.');
      process.exit(1);
    }
  } else {
    inputFile = path.resolve(root, inputFile);
    if (!fs.existsSync(inputFile)) {
      console.error(`\n❌ Input file not found: ${inputFile}`);
      process.exit(1);
    }
    console.log(`\n📄 Source: ${path.relative(root, inputFile)} (--input)`);
  }

  if (dryRun) {
    console.log('\n🔍 DRY RUN — no git writes or push will happen.\n');
  }

  // -------------------------------------------------------------------------
  // Worktree setup
  // -------------------------------------------------------------------------
  const tmpDir = path.join(os.tmpdir(), `gh-pages-deploy-${Date.now()}`);

  console.log(`\n🌿 Setting up gh-pages worktree at ${tmpDir} ...`);

  try {
    git(['worktree', 'add', '--force', tmpDir, 'gh-pages'], { dryRun });
  } catch (err) {
    console.error('\n❌ Failed to create git worktree:', err.message);
    process.exit(1);
  }

  // -------------------------------------------------------------------------
  // Copy → commit → push
  // -------------------------------------------------------------------------
  try {
    const dest = path.join(tmpDir, 'index.html');
    console.log(`\n📋 Copying to ${dryRun ? dest : dest} ...`);
    if (!dryRun) {
      fs.copyFileSync(inputFile, dest);
    }

    const worktreeCwd = dryRun ? root : tmpDir;

    console.log('\n📝 Staging ...');
    git(['add', 'index.html'], { cwd: worktreeCwd, dryRun });

    console.log('\n💬 Committing ...');
    try {
      git(['commit', '-m', commitMessage], { cwd: worktreeCwd, dryRun });
    } catch (err) {
      // If nothing changed, git commit exits with code 1 — treat as success
      if (!dryRun && err.message && err.message.includes('nothing to commit')) {
        console.log('   ℹ️  Nothing to commit — gh-pages is already up to date.');
      } else if (!dryRun) {
        throw err;
      }
    }

    console.log('\n🚀 Pushing to origin gh-pages ...');
    git(['push', 'origin', 'gh-pages'], { cwd: worktreeCwd, dryRun });

    if (dryRun) {
      console.log('\n✅ Dry run complete — no changes were made.');
    } else {
      console.log('\n✅ Deployed! https://eternal-crave.github.io/goosain-bolt/\n');
    }
  } finally {
    // Always clean up the worktree, even on failure
    try {
      console.log('\n🧹 Removing worktree ...');
      git(['worktree', 'remove', tmpDir, '--force']);
    } catch {
      // Non-fatal: temp dir will be cleaned by OS eventually
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
