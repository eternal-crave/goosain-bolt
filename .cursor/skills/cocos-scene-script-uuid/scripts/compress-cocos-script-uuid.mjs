#!/usr/bin/env node
/**
 * Prints Cocos Creator 3.x scene __type__ compressed id for a script UUID (from .meta).
 * Usage: node compress-cocos-script-uuid.mjs <uuid>
 * Example: node compress-cocos-script-uuid.mjs bffd5374-a54c-4a80-bcf5-c34456d312e3
 */

const BASE64_KEYS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';

function compressScriptUuid(uuid) {
  const stripped = String(uuid).replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(stripped)) {
    throw new Error(`Expected 32 hex chars (with or without hyphens); got: ${uuid}`);
  }
  const prefix = stripped.slice(0, 5);
  const rest = stripped.slice(5);
  let bits = 0;
  let bitLen = 0;
  let out = prefix;
  for (let i = 0; i < rest.length; i++) {
    bits = (bits << 4) | parseInt(rest[i], 16);
    bitLen += 4;
    while (bitLen >= 6) {
      bitLen -= 6;
      out += BASE64_KEYS[(bits >> bitLen) & 0x3f];
    }
  }
  if (bitLen > 0) {
    out += BASE64_KEYS[(bits << (6 - bitLen)) & 0x3f];
  }
  if (out.length !== 23) {
    throw new Error(`Unexpected output length ${out.length}; expected 23`);
  }
  return out;
}

const arg = process.argv[2];
if (!arg) {
  console.error('Usage: node compress-cocos-script-uuid.mjs <uuid-from-meta>');
  process.exit(1);
}
try {
  console.log(compressScriptUuid(arg));
} catch (e) {
  console.error(e.message || e);
  process.exit(1);
}
