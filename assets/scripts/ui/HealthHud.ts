import { _decorator, Component, Node } from 'cc';
import { PlayerHealth } from '../player/PlayerHealth';

const { ccclass, property } = _decorator;

/**
 * Editor wiring: under HUD Canvas, add this component; assign PlayerHealth (same as GameFlow uses);
 * assign `hearts` left-to-right — heart at index i stays active while current HP > i.
 */
@ccclass('HealthHud')
export class HealthHud extends Component {
    @property({
        type: [Node],
        tooltip: 'Heart nodes left-to-right; index i visible when current HP > i.',
    })
    public hearts: Node[] = [];

    @property({
        type: PlayerHealth,
        tooltip: 'Source of truth for HP; subscribe for label/heart updates.',
    })
    public health: PlayerHealth | null = null;

    public onLoad(): void {
        this.health?.onHealthChanged(this._syncHearts, this);
        this._syncHearts();
    }

    public onDestroy(): void {
        this.health?.offHealthChanged(this._syncHearts, this);
    }

    private _syncHearts(): void {
        const c = this.health?.current ?? 0;
        for (let i = 0; i < this.hearts.length; i++) {
            const n = this.hearts[i];
            if (n && n.isValid) {
                n.active = i < c;
            }
        }
    }
}
