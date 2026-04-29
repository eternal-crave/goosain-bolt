import { _decorator, CCFloat, Component } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Moves hazard left each frame; speed is assigned by Spawner from GameFlow.
 * speedScale > 1 reads as closing faster than world-matched scroll (e.g. charger).
 */
@ccclass('Obstacle')
export class Obstacle extends Component {
    @property({ type: CCFloat, tooltip: 'Multiplies moveSpeed; use >1 for hazards faster than background.' })
    public speedScale = 1;

    public moveSpeed = 0;

    public update(dt: number): void {
        if (this.moveSpeed <= 0) {
            return;
        }
        const step = this.moveSpeed * this.speedScale * dt;
        const p = this.node.position;
        this.node.setPosition(p.x - step, p.y, p.z);
    }
}
