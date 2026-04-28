import { _decorator, CCFloat, Component, EventTouch, Input, Node, Rect, UITransform, Vec3, input } from 'cc';
import { GameConfig } from '../config/GameConfig';
import { FinishZone } from '../finish/FinishZone';

const { ccclass, property } = _decorator;

@ccclass('PlayerController')
export class PlayerController extends Component {
    /** When false, jump input is ignored (menu / cutscenes). */
    public inputEnabled = false;

    @property({ type: CCFloat, tooltip: 'Upward velocity applied when the player jumps.' })
    public jumpVelocity = GameConfig.jumpVelocity;

    @property({ type: CCFloat, tooltip: 'Downward acceleration affecting jump arc.' })
    public gravity = GameConfig.gravity;

    @property({ type: CCFloat, tooltip: 'Grounded tolerance used to allow jump near floor.' })
    public groundSnapEpsilon = 3;

    private _velY = 0;
    private _tmpPos = new Vec3();

    public onLoad(): void {
        input.on(Input.EventType.TOUCH_START, this._onTouchStart, this);
        this.resetForRun();
    }

    public onDestroy(): void {
        input.off(Input.EventType.TOUCH_START, this._onTouchStart, this);
    }

    public resetForRun(): void {
        this._velY = 0;
        this.inputEnabled = false;
        this._tmpPos.set(GameConfig.playerX, GameConfig.groundY, this.node.position.z);
        this.node.setPosition(this._tmpPos);
    }

    public update(dt: number): void {
        if (!this.inputEnabled) {
            return;
        }
        this._velY -= this.gravity * dt;
        const p = this.node.position;
        const gy = GameConfig.groundY;
        let ny = p.y + this._velY * dt;
        if (ny <= gy) {
            ny = gy;
            this._velY = 0;
        }
        this.node.setPosition(p.x, ny, p.z);
    }

    public getWorldBounds(): Rect | null {
        const ui = this.node.getComponent(UITransform);
        return ui ? ui.getBoundingBoxToWorld() : null;
    }

    /**
     * Returns true if player AABB intersects any hazard node that has UITransform.
     * Skips nodes with FinishZone (finish is handled in GameFlow).
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
            if (n.getComponent(FinishZone) || n.getComponentInChildren(FinishZone)) {
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

    public overlapsFinish(finishRoot: Node | null): boolean {
        if (!finishRoot || !finishRoot.isValid) {
            return false;
        }
        if (!finishRoot.getComponent(FinishZone) && !finishRoot.getComponentInChildren(FinishZone)) {
            return false;
        }
        const selfBox = this.getWorldBounds();
        if (!selfBox) {
            return false;
        }
        const ui =
            finishRoot.getComponent(UITransform) ??
            finishRoot.getComponentInChildren(UITransform);
        if (!ui) {
            return false;
        }
        return selfBox.intersects(ui.getBoundingBoxToWorld());
    }

    private _onTouchStart(_e: EventTouch): void {
        if (!this.inputEnabled) {
            return;
        }
        const p = this.node.position;
        const gy = GameConfig.groundY;
        const grounded = p.y <= gy + this.groundSnapEpsilon && this._velY <= 0;
        if (grounded) {
            this._velY = this.jumpVelocity;
        }
    }
}
