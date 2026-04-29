---
name: cocos-ui-panel
description: Builds overlay or full-screen UI panels in Cocos Creator 3.x TypeScript—panel components, HUD/game-flow toggling, wallet and label binding, tween animations, and safe scene serialization. Use when adding menus, lose/win screens, modals, CTAs, or any Canvas/HUD UI the user will repeat across the project.
---

# Cocos Creator UI panels

## When to apply

- New UI overlay or full-screen view (lose/win, pause, reward, install CTA, settings).
- Wiring dynamic HUD data (`CurrencyWallet`, `Label`s, optional duplicate amounts).
- Looping UI motion (e.g. CTA scale pulse via `tween`; always stop tweens when hiding).
- Avoiding **Missing class** / invalid script errors for custom `@ccclass` scripts in `.scene` / `.prefab`.

## Architecture

1. **One component per panel root** (e.g. `LoseUi` on node `LosePanel`). Layout lives under that node; gameplay scripts only toggle visibility and pass references.
2. **Gameplay flow** (`GameFlow` or equivalent): `panel.node.active = true/false`; no tween/layout logic duplicated there unless trivial.
3. **Class layout** (match repo style): `@property` fields first, then lifecycle (`onEnable` / `onDisable` / `onDestroy`), then private methods.
4. **Scene/layout**: Prefer guiding the user in Editor for heavy hierarchy when faster; implement scripts and integration in code.

## Panel script checklist

- `@ccclass` + `@property`: wallet or data source, `Label`s, optional `Node` for animated CTA root.
- Subscriptions: `wallet.onBalanceChanged` in `onEnable`; `off` in `onDisable` and `onDestroy`.
- Money strings: consistent formatting (e.g. `$${Math.floor(amount).toFixed(2)}` if wallet is integer).
- Tweens: `tween(node).to(...).to(...).union().repeatForever().start()`; on hide/destroy use `Tween.stopAllByTarget(node)` so loops do not stack.
- Do not rename `.meta` UUIDs once assets reference them.

## Flow integration

- `@property(PanelComponent) panel` when the scene serializes the reference safely.
- Or `find('Canvas/HUD/YourPanel')` with **stable child names** for labels/nodes if wiring in code.
- **Runtime attach** (when Editor refuses or Missing class persists): on bootstrap (`GameFlow.onLoad` or similar):
  - `node.getComponent(Panel) ?? node.addComponent(Panel)`
  - Assign `wallet`, labels, `ctaNode` via `getChildByName` / `getComponent(Label)`.
- Re-call wiring before showing the panel if references can be null (e.g. start of lose handler).

## Scene / prefab

- Panel root: `UITransform` + `Widget` (full stretch), `active = false` until the flow shows it.
- Name children predictably for code wiring (`LoseTitle`, `InstallCta`, …).
- Sprites: prefer `assets/art/textures/` when art exists in repo.

## Serialization rules (critical)

- **Never** hand-author or paste `__type__` strings for custom scripts in `Main.scene` / prefab JSON. Let **Cocos Creator** add the component (Inspector → Add Component / drag `.ts`), which writes the correct id.
- If you must edit JSON for nodes/layout, omit custom script components and use **runtime `addComponent` + wiring** instead.

## Anti-patterns

- Orphan tweens after panel hide.
- Duplicate `onBalanceChanged` without `off` on disable/destroy.
- Changing script UUID in `.meta` without updating all references.

## Verify

- No **Missing class** / invalid script on the panel node after save.
- Play mode: panel visibility matches game state; amounts update; CTA animation runs only while visible.
