import { _decorator, Component, EventTouch, Input, Node, Rect, UITransform, Vec2, Vec3, input } from 'cc';
import { GameConfig, type LaneIndex } from '../config/GameConfig';

const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    @property({ tooltip: 'Optional explicit lane X positions; leave empty to use GameConfig.laneXs' })
    public laneOffsets: number[] = [];

    private _lane: LaneIndex = 1;
    private _touchStart = new Vec2(0, 0);
    private _hasTouch = false;
    private _tmpPos = new Vec3();

    public onLoad(): void {
        const x = this._laneX(this._lane);
        this.node.setPosition(x, GameConfig.playerY, this.node.position.z);
        input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.on(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.on(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.on(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
        this._applyLane(false);
    }

    public onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
        input.off(Input.EventType.TOUCH_MOVE, this._onTouchMove, this);
        input.off(Input.EventType.TOUCH_END, this._onTouchEnd, this);
        input.off(Input.EventType.TOUCH_CANCEL, this._onTouchEnd, this);
    }

    public resetToCenterLane(): void {
        this._lane = 1;
        const x = this._laneX(this._lane);
        this.node.setPosition(x, GameConfig.playerY, this.node.position.z);
    }

    public getLane(): LaneIndex {
        return this._lane;
    }

    public getWorldBounds(): Rect | null {
        const ui = this.node.getComponent(UITransform);
        return ui ? ui.getBoundingBoxToWorld() : null;
    }

    /**
     * Returns true if player AABB intersects any obstacle node that has UITransform.
     */
    public hitsAnyObstacle(activeObstacles: readonly Node[]): boolean {
        const selfBox = this.getWorldBounds();
        if (!selfBox) {
            return false;
        }
        for (const n of activeObstacles) {
            if (!n || !n.active) {
                continue;
            }
            const ui = n.getComponent(UITransform);
            if (!ui) {
                continue;
            }
            const other = ui.getBoundingBoxToWorld();
            if (selfBox.intersects(other)) {
                return true;
            }
        }
        return false;
    }

    private _laneX(index: LaneIndex): number {
        const xs = this.laneOffsets.length >= 3 ? this.laneOffsets : GameConfig.laneXs;
        return xs[index] ?? 0;
    }

    private _applyLane(_animate: boolean): void {
        const x = this._laneX(this._lane);
        this._tmpPos.set(x, GameConfig.playerY, this.node.position.z);
        this.node.setPosition(this._tmpPos);
    }

    private _bumpLane(delta: -1 | 1): void {
        const next = Math.min(2, Math.max(0, this._lane + delta)) as LaneIndex;
        if (next !== this._lane) {
            this._lane = next;
            this._applyLane(true);
        }
    }

    private _onTouchStart(e: EventTouch): void {
        this._hasTouch = true;
        e.getUILocation(this._touchStart);
    }

    private _onTouchMove(e: EventTouch): void {
        if (!this._hasTouch) {
            return;
        }
        const cur = e.getUILocation();
        const dx = cur.x - this._touchStart.x;
        if (Math.abs(dx) >= GameConfig.swipeThreshold) {
            this._bumpLane(dx < 0 ? -1 : 1);
            this._touchStart.set(cur);
        }
    }

    private _onTouchEnd(e: EventTouch): void {
        if (!this._hasTouch) {
            return;
        }
        this._hasTouch = false;
        const cur = e.getUILocation();
        const dx = cur.x - this._touchStart.x;
        if (Math.abs(dx) >= GameConfig.swipeThreshold * 0.5) {
            this._bumpLane(dx < 0 ? -1 : 1);
        }
    }
}
