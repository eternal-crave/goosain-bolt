/**
 * Removes serialized LoseUi component at index 84 from Main.scene and renumbers __id__ refs > 84.
 * Runtime wiring is handled by GameFlow._ensureLoseUi().
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const scenePath = path.join(__dirname, '..', 'assets', 'scenes', 'Main.scene');

const raw = fs.readFileSync(scenePath, 'utf8');
const arr = JSON.parse(raw);

if (arr[84]?.['__type__'] !== 'abbdc2EIkZJbqjVqvG/S+8Y') {
  console.error('Expected LoseUi component at index 84; got:', arr[84]?.['__type__']);
  process.exit(1);
}

/** Deep-replace { __id__: n } where n > threshold -> n - 1 */
function renumberRefs(obj, threshold) {
  if (obj === null || obj === undefined) {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map((item) => renumberRefs(item, threshold));
  }
  if (typeof obj === 'object') {
    if (Object.prototype.hasOwnProperty.call(obj, '__id__') && typeof obj.__id__ === 'number') {
      if (obj.__id__ > threshold) {
        return { ...obj, __id__: obj.__id__ - 1 };
      }
      return { ...obj };
    }
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = renumberRefs(v, threshold);
    }
    return out;
  }
  return obj;
}

const THRESHOLD = 84;

const losePanel = arr[81];
if (!losePanel || losePanel.__type__ !== 'cc.Node' || losePanel._name !== 'LosePanel') {
  console.error('Expected LosePanel at index 81');
  process.exit(1);
}
losePanel._components = losePanel._components.filter((c) => c.__id__ !== THRESHOLD);

const gameFlow = arr[42];
if (!gameFlow || gameFlow.__type__ !== 'f97e8Pez6hBn5u/NcZ4OIxM') {
  console.error('Expected GameFlow at index 42');
  process.exit(1);
}
gameFlow.loseUi = null;

arr.splice(THRESHOLD, 1);

const patched = renumberRefs(arr, THRESHOLD);

fs.writeFileSync(scenePath, JSON.stringify(patched, null, 2) + '\n', 'utf8');
console.log('Patched Main.scene: removed LoseUi at index', THRESHOLD, 'new length', patched.length);
