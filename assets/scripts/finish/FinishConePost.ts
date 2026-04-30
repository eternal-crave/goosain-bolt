import { _decorator, CCFloat, Component, easing, Tween, tween } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Attach to each cone-post node in the FinishLine prefab.
 * Plays a quick lean-and-settle tween when the player breaks the rope.
 */
@ccclass('FinishConePost')
export class FinishConePost extends Component {
    // ─── Inspector fields ───────────────────────────────────────────────────

    @property({
        type: CCFloat,
        tooltip: 'Peak lean angle in degrees when the rope is crossed.',
    })
    public leanAngle = 14;

    @property({
        type: CCFloat,
        tooltip: 'Time to reach peak lean (seconds).',
    })
    public leanDuration = 0.12;

    @property({
        type: CCFloat,
        tooltip: 'Time to bounce back and settle (seconds).',
    })
    public settleDuration = 0.28;

    // ─── Public API ──────────────────────────────────────────────────────────

    /** Play the impact wobble. Called by FinishRope.playSplit(). Safe to call multiple times. */
    public playCrossed(): void {
        Tween.stopAllByTarget(this.node);
        const baseAngle = 0;
        tween(this.node)
            .to(this.leanDuration, { angle: baseAngle + this.leanAngle }, { easing: easing.sineOut })
            .to(this.settleDuration * 0.5, { angle: baseAngle - this.leanAngle * 0.3 }, { easing: easing.sineInOut })
            .to(this.settleDuration * 0.5, { angle: baseAngle }, { easing: easing.sineOut })
            .start();
    }
}
