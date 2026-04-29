import { Node, Rect, Sprite, UITransform } from 'cc';

function rectFromSprite(sprite: Sprite | null): Rect | null {
    if (!sprite?.node?.isValid) {
        return null;
    }
    const ui = sprite.node.getComponent(UITransform);
    return ui?.getBoundingBoxToWorld() ?? null;
}

/**
 * World-space AABB for gameplay collision.
 * Priority: hitboxSprite → Sprite on root → root UITransform (legacy behavior before dedicated hitboxes).
 */
export function getCollisionWorldRect(root: Node, hitboxSprite: Sprite | null): Rect | null {
    if (hitboxSprite?.node?.isValid) {
        const fromHitbox = rectFromSprite(hitboxSprite);
        if (fromHitbox) {
            return fromHitbox;
        }
    }
    const rootSprite = root.getComponent(Sprite);
    if (rootSprite?.node?.isValid) {
        const fromRootSprite = rectFromSprite(rootSprite);
        if (fromRootSprite) {
            return fromRootSprite;
        }
    }
    const ui = root.getComponent(UITransform);
    return ui?.getBoundingBoxToWorld() ?? null;
}
