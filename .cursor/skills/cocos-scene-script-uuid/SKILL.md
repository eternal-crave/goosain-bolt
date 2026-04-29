---
name: cocos-scene-script-uuid
description: Computes Cocos Creator 3.x compressed script UUIDs for scene and prefab JSON so __type__ matches the editor asset database. Use after hand-editing .scene or .prefab files, when fixing Missing class or invalid script attachment errors, or when adding cc.Component entries outside the editor.
---

# Cocos scene script `__type__` (compressed UUID)

## When this applies

Cocos Creator serializes custom script components with `"__type__": "<compressedId>"`, not the class name. If the string is wrong, the editor reports **Missing class** or **Script is missing or invalid** even when the `.ts` and `.meta` exist.

## Correct format (Creator 3.8+)

For a script asset UUID from its `.meta` (36-char hyphenated form):

1. Strip hyphens → 32 hex characters.
2. **`__type__` length is 23 characters**, not 22.
3. Build: **first 5 hex characters literally** + **18 base64 URL-safe alphabet characters** encoding the remaining **27** hex nibbles as a bit stream (MSB first), 6 bits per output character.

Base64 alphabet (same order Cocos uses for these ids):

`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=`

Do **not** use the older **22-character** scheme (first 2 hex + 10 base64 pairs) from `decodeUuid`-style docs; that produces a different string and breaks class resolution.

## Workflow after editing scenes or prefabs

1. Read the script’s UUID from that script’s `.meta` file (`uuid` field, e.g. `assets/scripts/player/PlayerController.ts.meta`).
2. Compute compressed id with the helper (recommended):

   ```bash
   node .cursor/skills/cocos-scene-script-uuid/scripts/compress-cocos-script-uuid.mjs <full-uuid>
   ```

3. Set the component’s `"__type__"` in the JSON to that output (quoted string).
4. Reopen the scene in Creator or refresh assets; confirm the script slot resolves.

## Safer alternatives

- Prefer attaching new components in **Cocos Creator** so `__type__` is written by the editor.
- Or add the component at **runtime** (e.g. `node.addComponent(MyScript)`) and wire references in code to avoid fragile manual JSON.

## Verification

Given UUID `bffd5374-a54c-4a80-bcf5-c34456d312e3`, the compressed form must be exactly `bffd5N0pUxKgLz1w0RW0xLj` (23 chars). Compare any new script’s output to a working script in the same project’s scene file.

## Helper script

See [scripts/compress-cocos-script-uuid.mjs](scripts/compress-cocos-script-uuid.mjs) for the reference implementation used from the CLI.
