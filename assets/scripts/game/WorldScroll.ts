import { _decorator, CCFloat, Component, Node, UITransform } from 'cc';
import { GameConfig } from '../config/GameConfig';

const { ccclass, property } = _decorator;

/**
 * Side-scroller background:
 * - If **wrapTiles** has 2+ nodes, they scroll left with gameplay speed and wrap as an infinite strip.
 * - Otherwise **parallaxRoots** move left at speed × **parallaxMultiplier** (single-layer drift).
 */
@ccclass('WorldScroll')
export class WorldScroll extends Component {
    @property({ type: [Node], tooltip: 'Layers that scroll slower than gameplay (used when wrapTiles < 2)' })
    public parallaxRoots: Node[] = [];

    @property({ tooltip: 'Multiplier applied to external speed for parallaxRoots' })
    public parallaxMultiplier = 0.35;

    @property({ type: [Node], tooltip: 'Two or more tile roots for infinite horizontal loop (optional)' })
    public wrapTiles: Node[] = [];

    @property({ type: CCFloat, tooltip: 'Left bound (local) for recycling a wrap tile' })
    public wrapLeftBound = -740;

    private _speed = 0;

    public setScrollSpeed(speed: number): void {
        this._speed = speed;
    }

    public onLoad(): void {
        if (this.wrapTiles.length >= 2) {
            this._normalizeStrip();
        }
    }

    public update(dt: number): void {
        if (this._speed <= 0) {
            return;
        }
        if (this.wrapTiles.length >= 2) {
            this._updateWrap(dt);
            return;
        }
        const step = this._speed * this.parallaxMultiplier * dt;
        for (const root of this.parallaxRoots) {
            if (!root) {
                continue;
            }
            const p = root.position;
            root.setPosition(p.x - step, p.y, p.z);
        }
    }

    private _normalizeStrip(): void {
        if (this.wrapTiles.length < 2) {
            return;
        }
        const first = this.wrapTiles[0];
        if (!first || !first.isValid) {
            return;
        }
        let prev = first;
        for (let i = 1; i < this.wrapTiles.length; i++) {
            const cur = this.wrapTiles[i];
            if (!cur || !cur.isValid) {
                continue;
            }
            const prevW = this._tileWidth(prev);
            const curW = this._tileWidth(cur);
            const x = prev.position.x + (prevW + curW) * 0.5;
            cur.setPosition(x, cur.position.y, cur.position.z);
            prev = cur;
        }
    }

    private _updateWrap(dt: number): void {
        const step = this._speed * dt;
        for (const t of this.wrapTiles) {
            if (!t || !t.isValid) {
                continue;
            }
            const p = t.position;
            t.setPosition(p.x - step, p.y, p.z);
        }
        for (let i = 0; i < this.wrapTiles.length; i++) {
            const t = this.wrapTiles[i];
            if (!t || !t.isValid) {
                continue;
            }
            const w = this._tileWidth(t);
            const right = t.position.x + w * 0.5;
            if (right < this.wrapLeftBound) {
                const otherMax = this._maxRightAmongExcept(i);
                t.setPosition(otherMax + w * 0.5, t.position.y, t.position.z);
            }
        }
    }

    private _tileWidth(n: Node): number {
        const ui = n.getComponent(UITransform);
        if (ui) {
            return ui.contentSize.width;
        }
        return GameConfig.bgTileWidth;
    }

    private _maxRightAmongExcept(skipIndex: number): number {
        let max = -1e9;
        for (let i = 0; i < this.wrapTiles.length; i++) {
            if (i === skipIndex) {
                continue;
            }
            const t = this.wrapTiles[i];
            if (!t || !t.isValid) {
                continue;
            }
            const w = this._tileWidth(t);
            const r = t.position.x + w * 0.5;
            if (r > max) {
                max = r;
            }
        }
        return max;
    }
}
