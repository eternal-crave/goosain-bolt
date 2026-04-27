import { _decorator, Component } from 'cc';

const { ccclass } = _decorator;

/**
 * Moves obstacle downward each frame; speed is assigned by Spawner from GameFlow.
 */
@ccclass('Obstacle')
export class Obstacle extends Component {
    public moveSpeed = 0;

    public update(dt: number): void {
        if (this.moveSpeed <= 0) {
            return;
        }
        const p = this.node.position;
        this.node.setPosition(p.x, p.y - this.moveSpeed * dt, p.z);
    }
}
