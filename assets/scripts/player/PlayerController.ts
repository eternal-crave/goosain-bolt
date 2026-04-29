import {
    _decorator,
    CCFloat,
    Component,
    EventTouch,
    Input,
    Node,
    Rect,
    Sprite,
    UITransform,
    Vec3,
    input,
} from 'cc';
import { GameConfig } from '../config/GameConfig';
import { FinishZone } from '../finish/FinishZone';
import { getCollisionWorldRect } from '../game/HitboxBounds';
import { Obstacle } from '../game/Obstacle';
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

    @property({
        type: Sprite,
        tooltip:
            'Optional sprite whose UITransform defines the hitbox. If empty, uses legacy bounds: root Sprite, else root UITransform.',
    })
    public hitboxSprite: Sprite | null = null;

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

    /** World-space bounds used for hazards, currency, and finish overlap. */
    public getWorldBounds(): Rect | null {
        return getCollisionWorldRect(this.node, this.hitboxSprite);
    }

    /**
     * Hazard roots that currently overlap the player (same rules as hitsAnyObstacle).
     * Skips nodes with FinishZone (finish is handled in GameFlow).
     */
    public getOverlappingObstacleRoots(activeObstacles: readonly Node[]): Node[] {
        const selfBox = this.getWorldBounds();
        if (!selfBox) {
            return [];
        }
        const out: Node[] = [];
        for (const n of activeObstacles) {
            if (!n || !n.active) {
                continue;
            }
            if (n.getComponent(FinishZone) || n.getComponentInChildren(FinishZone)) {
                continue;
            }
            const obstacle = n.getComponent(Obstacle);
            const otherBox = obstacle
                ? obstacle.getCollisionWorldRect()
                : n.getComponent(UITransform)?.getBoundingBoxToWorld() ?? null;
            if (!otherBox) {
                continue;
            }
            if (selfBox.intersects(otherBox)) {
                out.push(n);
            }
        }
        return out;
    }

    /**
     * Returns true if player AABB intersects any hazard node that has UITransform.
     * Skips nodes with FinishZone (finish is handled in GameFlow).
     */
    public hitsAnyObstacle(activeObstacles: readonly Node[]): boolean {
        return this.getOverlappingObstacleRoots(activeObstacles).length > 0;
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
