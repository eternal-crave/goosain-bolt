import { _decorator, CCFloat, Component, EventTouch, Input, Node, Rect, UITransform, Vec3, input } from 'cc';
import { GameConfig } from '../config/GameConfig';
import { FinishZone } from '../finish/FinishZone';
import { PlayerVisualAnimator } from './PlayerVisualAnimator';

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
    private _visual: PlayerVisualAnimator | null = null;

    public onLoad(): void {
        if (!this.node.getComponent(PlayerVisualAnimator)) {
            this.node.addComponent(PlayerVisualAnimator);
        }
        this._visual = this.node.getComponent(PlayerVisualAnimator);
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
        this._visual?.resetToIdle();
    }

    /** Stops run/jump/land clips without resetting position (win / lose). */
    public stopPresentation(): void {
        this._visual?.resetToIdle();
    }

    public update(dt: number): void {
        if (!this.inputEnabled) {
            return;
        }
        const p = this.node.position;
        const gy = GameConfig.groundY;
        const eps = this.groundSnapEpsilon;
        const groundedBefore = p.y <= gy + eps && this._velY <= 0;

        this._velY -= this.gravity * dt;
        let ny = p.y + this._velY * dt;
        if (ny <= gy) {
            ny = gy;
            this._velY = 0;
        }
        const groundedAfter = ny <= gy + eps && this._velY <= 0;
        if (!groundedBefore && groundedAfter) {
            this._visual?.notifyLanded();
        }
        this.node.setPosition(p.x, ny, p.z);
    }

    public getWorldBounds(): Rect | null {
        const ui = this.node.getComponent(UITransform);
        return ui ? ui.getBoundingBoxToWorld() : null;
    }

    private _buildInsetWorldBounds(source: Readonly<Rect>, insetX: number, insetY: number): Rect {
        const clampedInsetX = Math.max(0, insetX);
        const clampedInsetY = Math.max(0, insetY);
        const width = Math.max(1, source.width - clampedInsetX * 2);
        const height = Math.max(1, source.height - clampedInsetY * 2);
        return new Rect(
            source.x + clampedInsetX,
            source.y + clampedInsetY,
            width,
            height
        );
    }

    private _getBestObstacleWorldBounds(obstacleRoot: Node): Rect | null {
        const rootUi = obstacleRoot.getComponent(UITransform);
        let best = rootUi ? rootUi.getBoundingBoxToWorld() : null;
        const candidates = obstacleRoot.getComponentsInChildren(UITransform);
        for (const ui of candidates) {
            if (!ui.node.activeInHierarchy) {
                continue;
            }
            const next = ui.getBoundingBoxToWorld();
            if (next.width <= 0 || next.height <= 0) {
                continue;
            }
            if (!best || next.width * next.height < best.width * best.height) {
                best = next;
            }
        }
        return best;
    }

    private _hasMeaningfulOverlap(a: Readonly<Rect>, b: Readonly<Rect>): boolean {
        const overlapX =
            Math.min(a.x + a.width, b.x + b.width) -
            Math.max(a.x, b.x);
        const overlapY =
            Math.min(a.y + a.height, b.y + b.height) -
            Math.max(a.y, b.y);
        if (overlapX <= 0 || overlapY <= 0) {
            return false;
        }
        return (
            overlapX >= GameConfig.collisionMinOverlapX &&
            overlapY >= GameConfig.collisionMinOverlapY
        );
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
        const selfInsetBox = this._buildInsetWorldBounds(
            selfBox,
            GameConfig.collisionInsetPlayerX,
            GameConfig.collisionInsetPlayerY
        );
        for (const n of activeObstacles) {
            if (!n || !n.active) {
                continue;
            }
            if (n.getComponent(FinishZone) || n.getComponentInChildren(FinishZone)) {
                continue;
            }
            const obstacleBounds = this._getBestObstacleWorldBounds(n);
            if (!obstacleBounds) {
                continue;
            }
            const obstacleInsetBox = this._buildInsetWorldBounds(
                obstacleBounds,
                GameConfig.collisionInsetObstacleX,
                GameConfig.collisionInsetObstacleY
            );
            if (this._hasMeaningfulOverlap(selfInsetBox, obstacleInsetBox)) {
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
            this._visual?.notifyJump();
        }
    }
}
