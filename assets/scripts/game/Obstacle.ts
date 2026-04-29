import { _decorator, CCFloat, Component, Rect, Sprite } from 'cc';
import { getCollisionWorldRect } from './HitboxBounds';

const { ccclass, property } = _decorator;

/**
 * Moves hazard left each frame; speed is assigned by Spawner from GameFlow.
 * speedScale > 1 reads as closing faster than world-matched scroll (e.g. charger).
 */
@ccclass('Obstacle')
export class Obstacle extends Component {
    @property({ type: CCFloat, tooltip: 'Multiplies moveSpeed; use >1 for hazards faster than background.' })
    public speedScale = 1;

    @property({
        type: Sprite,
        tooltip:
            'Optional sprite whose UITransform defines the hitbox. If empty, uses legacy bounds: root Sprite, else root UITransform.',
    })
    public hitboxSprite: Sprite | null = null;

    public moveSpeed = 0;

    public update(dt: number): void {
        if (this.moveSpeed <= 0) {
            return;
        }
        const step = this.moveSpeed * this.speedScale * dt;
        const p = this.node.position;
        this.node.setPosition(p.x - step, p.y, p.z);
    }

    /** World-space collision bounds for this hazard root. */
    public getCollisionWorldRect(): Rect | null {
        return getCollisionWorldRect(this.node, this.hitboxSprite);
    }
}
