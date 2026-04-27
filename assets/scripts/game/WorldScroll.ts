import { _decorator, Component, Node } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Optional parallax: moves configured roots by a fraction of gameplay speed.
 * Gameplay obstacles use Obstacle.ts; use this for background layers only.
 */
@ccclass('WorldScroll')
export class WorldScroll extends Component {
    @property({ type: [Node], tooltip: 'Layers that scroll slower than gameplay' })
    public parallaxRoots: Node[] = [];

    @property({ tooltip: 'Multiplier applied to external speed each frame' })
    public parallaxMultiplier = 0.35;

    private _speed = 0;

    public setScrollSpeed(speed: number): void {
        this._speed = speed;
    }

    public update(dt: number): void {
        if (this._speed <= 0 || this.parallaxRoots.length === 0) {
            return;
        }
        const step = this._speed * this.parallaxMultiplier * dt;
        for (const root of this.parallaxRoots) {
            if (!root) {
                continue;
            }
            const p = root.position;
            root.setPosition(p.x, p.y - step, p.z);
        }
    }
}
