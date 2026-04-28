/**
 * Packs a Cocos Creator Web Mobile build folder into one self-contained HTML file.
 * Strategy: (1) virtual FS map for all files as base64 (2) XHR + fetch intercept
 * (3) best-effort inline of <script src> and <link rel="stylesheet"> for boot files.
 *
 * Usage: node tools/playable-pack.mjs --input build/web-mobile --output dist/playable.html
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
/** Repo root (this file lives in tools/). */
const root = path.resolve(__dirname, '..');

function arg(name, fallback) {
    const i = process.argv.indexOf(name);
    if (i >= 0 && process.argv[i + 1]) {
        return process.argv[i + 1];
    }
    return fallback;
}

const inputDir = path.resolve(root, arg('--input', path.join('build', 'web-mobile')));
const outputFile = path.resolve(root, arg('--output', path.join('dist', 'playable.html')));

const MAX_BYTES = 5 * 1024 * 1024;

function walkFiles(dir) {
    /** @type {string[]} */
    const out = [];
    if (!fs.existsSync(dir)) {
        console.error(`Input folder missing: ${dir}`);
        process.exit(2);
    }
    const stack = [dir];
    while (stack.length) {
        const cur = stack.pop();
        const ents = fs.readdirSync(cur, { withFileTypes: true });
        for (const e of ents) {
            const p = path.join(cur, e.name);
            if (e.isDirectory()) {
                stack.push(p);
            } else {
                out.push(p);
            }
        }
    }
    return out;
}

function toPosix(p) {
    return p.split(path.sep).join('/');
}

function buildVfsMap(absPaths, baseDir) {
    /** @type {Record<string, string>} */
    const vfs = {};
    for (const abs of absPaths) {
        const rel = toPosix(path.relative(baseDir, abs));
        const b64 = fs.readFileSync(abs).toString('base64');
        vfs[rel] = b64;
        vfs[`./${rel}`] = b64;
        const base = path.basename(rel);
        if (!vfs[`@/${base}`]) {
            vfs[`@/${base}`] = b64;
        }
    }
    return vfs;
}

function patchScript(vfsLiteral) {
    return `(() => {
  const __VFS = ${vfsLiteral};
  function __b64ToBuf(b64){
    const bin = atob(b64);
    const len = bin.length;
    const u8 = new Uint8Array(len);
    for (let i=0;i<len;i++) u8[i]=bin.charCodeAt(i);
    return u8.buffer;
  }
  function __mime(k){
    if (k.endsWith('.json')) return 'application/json';
    if (k.endsWith('.wasm')) return 'application/wasm';
    if (k.endsWith('.png')) return 'image/png';
    if (k.endsWith('.jpg')||k.endsWith('.jpeg')) return 'image/jpeg';
    if (k.endsWith('.webp')) return 'image/webp';
    if (k.endsWith('.js')||k.endsWith('.mjs')) return 'application/javascript';
    if (k.endsWith('.css')) return 'text/css';
    return 'application/octet-stream';
  }
  function __lookup(url){
    let u = typeof url === 'string' ? url : '';
    u = u.split('#')[0].split('?')[0];
    if (u.startsWith('http://')||u.startsWith('https://')){
      try {
        u = decodeURIComponent(new URL(u).pathname);
        while(u.startsWith('/')) u=u.slice(1);
      } catch(e){ return null; }
    } else {
      u = u.split(String.fromCharCode(92)).join('/');
      while(u.startsWith('/')) u=u.slice(1);
      if(u.startsWith('./')) u=u.slice(2);
    }
    if(__VFS[u]) return u;
    const tail = u.includes('/') ? u.slice(u.lastIndexOf('/')+1) : u;
    const tries = [u, './'+u, tail, '@/'+tail];
    for(const t of tries){ if(__VFS[t]) return t; }
    return null;
  }
  const __origFetch = window.fetch;
  window.fetch = function(input, init){
    const url = typeof input === 'string' ? input : (input && input.url);
    const k = __lookup(url || '');
    if (k && __VFS[k]){
      const buf = __b64ToBuf(__VFS[k]);
      return Promise.resolve(new Response(buf, { status:200, headers:{ 'Content-Type': __mime(k) } }));
    }
    return __origFetch.apply(this, arguments);
  };
  const __open = XMLHttpRequest.prototype.open;
  const __send = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.open = function(method, url){
    this.__playable_url = url;
    return __open.apply(this, arguments);
  };
  XMLHttpRequest.prototype.send = function(body){
    const url = this.__playable_url;
    const k = __lookup(url || '');
    if (k && __VFS[k]){
      const buf = __b64ToBuf(__VFS[k]);
      const self = this;
      self.readyState = 4;
      self.status = 200;
      self.response = buf;
      self.responseText = '';
      queueMicrotask(() => {
        try { self.dispatchEvent(new Event('load')); } catch(e) {}
        try { self.onload && self.onload(); } catch(e2) {}
      });
      return;
    }
    return __send.apply(this, arguments);
  };
})();`;
}

function tryInlineLocalTags(html, baseDir) {
    let out = html;
    out = out.replace(/<script([^>]*?)\ssrc=["']([^"']+)["']([^>]*)>\s*<\/script>/gi, (full, pre, src, post) => {
        if (/^https?:/i.test(src)) {
            return full;
        }
        const abs = path.join(baseDir, decodeURIComponent(src));
        if (!fs.existsSync(abs)) {
            return full;
        }
        const body = fs.readFileSync(abs, 'utf8');
        return `<script${pre}${post}>${body}</script>`;
    });
    out = out.replace(/<link([^>]*?)\srel=["']stylesheet["']([^>]*?)\shref=["']([^"']+)["']([^>]*)>/gi, (full, a, b, href, c) => {
        if (/^https?:/i.test(href)) {
            return full;
        }
        const abs = path.join(baseDir, decodeURIComponent(href));
        if (!fs.existsSync(abs)) {
            return full;
        }
        const body = fs.readFileSync(abs, 'utf8');
        return `<style>${body}</style>`;
    });
    return out;
}

function ensureDir(p) {
    fs.mkdirSync(path.dirname(p), { recursive: true });
}

function main() {
    const files = walkFiles(inputDir);
    const vfs = buildVfsMap(files, inputDir);
    const indexPath = path.join(inputDir, 'index.html');
    if (!fs.existsSync(indexPath)) {
        console.error(`index.html not found under ${inputDir}`);
        process.exit(3);
    }
    let html = fs.readFileSync(indexPath, 'utf8');
    html = tryInlineLocalTags(html, inputDir);
    const vfsLiteral = JSON.stringify(vfs);
    const patch = patchScript(vfsLiteral);
    const inject = `<script>${patch}</script>`;
    if (html.includes('<head>')) {
        html = html.replace('<head>', `<head>${inject}`);
    } else {
        html = inject + html;
    }
    ensureDir(outputFile);
    fs.writeFileSync(outputFile, html, 'utf8');
    const st = fs.statSync(outputFile);
    console.log(`Wrote ${outputFile} (${st.size} bytes)`);
    if (st.size > MAX_BYTES) {
        console.warn(`Warning: output exceeds ${MAX_BYTES} bytes (TestTask limit).`);
    } else {
        console.log(`Size OK: under ${MAX_BYTES} bytes.`);
    }
}

main();
