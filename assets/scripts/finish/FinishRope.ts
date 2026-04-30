import { _decorator, Component, Node } from 'cc';
import { Obstacle } from '../game/Obstacle';
import { FinishConePost } from './FinishConePost';
import { RopeRenderer } from './RopeRenderer';

const { ccclass, property } = _decorator;

/**
 * High-level finish-line controller for the rope + cone-post setup.
 *
 * Attach to the FinishLine prefab root (alongside Obstacle and FinishZone).
 * Wire ropeRenderer to the RopeNode child, leftCone / rightCone to the post nodes.
 *
 * GameFlow calls playSplit() on overlap — this stops the obstacle scroll,
 * triggers the rope break animation and makes the cones wobble.
 */
@ccclass('FinishRope')
export class FinishRope extends Component {
    // ─── Inspector fields ───────────────────────────────────────────────────

    @property({
        type: RopeRenderer,
        tooltip: 'The RopeRenderer component on the RopeNode child.',
    })
    public ropeRenderer: RopeRenderer | null = null;

    @property({
        type: Node,
        tooltip: 'Left cone post node (must have FinishConePost attached).',
    })
    public leftCone: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Right cone post node (must have FinishConePost attached).',
    })
    public rightCone: Node | null = null;

    // ─── Private state ───────────────────────────────────────────────────────

    private _triggered = false;

    // ─── Public API ──────────────────────────────────────────────────────────

    /**
     * Called by GameFlow when the player overlaps the finish zone.
     * Freezes forward motion, breaks the rope and wobbles the cone posts.
     * Safe to call multiple times.
     */
    public playSplit(): void {
        if (this._triggered) {
            return;
        }
        this._triggered = true;

        this._stopObstacle();
        this._breakRope();
        this._wobbleCones();
    }

    // ─── Private helpers ─────────────────────────────────────────────────────

    private _stopObstacle(): void {
        const obs = this.node.getComponent(Obstacle);
        if (obs) {
            obs.moveSpeed = 0;
        }
    }

    private _breakRope(): void {
        this.ropeRenderer?.playSplit();
    }

    private _wobbleCones(): void {
        this.leftCone?.getComponent(FinishConePost)?.playCrossed();
        this.rightCone?.getComponent(FinishConePost)?.playCrossed();
    }
}
