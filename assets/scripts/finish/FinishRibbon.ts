import { _decorator, Color, Component, Graphics, Node, Rect, UITransform, Vec2 } from 'cc';
import { GameConfig } from '../config/GameConfig';
import type { IRunnerState } from '../game/IRunnerState';

const { ccclass, property } = _decorator;

@ccclass('FinishRibbon')
export class FinishRibbon extends Component {
    @property({ type: Node, tooltip: 'Optional separate trigger rect; defaults to this node UITransform' })
    public triggerNode: Node | null = null;

    @property({ type: Node, tooltip: 'Player root for win overlap' })
    public playerNode: Node | null = null;

    /** Set at runtime by GameFlow (not serialized). */
    public flowTarget: IRunnerState | null = null;

    @property
    public ribbonWidth = 520;

    @property
    public lineWidth = 14;

    @property
    public ropeColor = new Color(255, 230, 80, 255);

    private _graphics: Graphics | null = null;
    private _points: Vec2[] = [];
    private _prev: Vec2[] = [];
    private _pinnedLeft = new Vec2();
    private _pinnedRight = new Vec2();
    private _runSpeed = 0;
    private _phase = 0;
    private _won = false;

    public onLoad(): void {
        this._graphics = this.node.getComponent(Graphics) ?? this.node.addComponent(Graphics);
        const n = GameConfig.ribbonSegments;
        this._points = [];
        this._prev = [];
        for (let i = 0; i < n; i++) {
            this._points.push(new Vec2());
            this._prev.push(new Vec2());
        }
        this._initRestPositions();
    }

    public setRunSpeed(speed: number): void {
        this._runSpeed = speed;
    }

    public update(dt: number): void {
        if (this._won) {
            return;
        }
        this._phase += dt * 6;
        this._updatePins();
        this._verlet(dt);
        this._drawRibbon();
        this._checkWin();
    }

    private _initRestPositions(): void {
        const half = this.ribbonWidth * 0.5;
        const n = this._points.length;
        for (let i = 0; i < n; i++) {
            const t = i / (n - 1);
            const x = -half + t * this.ribbonWidth;
            const y = -20 * Math.sin(Math.PI * t);
            this._points[i].set(x, y);
            this._prev[i].set(x, y);
        }
    }

    private _updatePins(): void {
        const half = this.ribbonWidth * 0.5;
        const sway = Math.sin(this._phase) * 8 + this._runSpeed * 0.01;
        this._pinnedLeft.set(-half + sway * 0.3, 40);
        this._pinnedRight.set(half - sway * 0.3, 40);
    }

    private _verlet(dt: number): void {
        const pts = this._points;
        const prev = this._prev;
        const n = pts.length;
        if (n < 2) {
            return;
        }
        const iterations = GameConfig.ribbonIterations;
        const damping = 1 - GameConfig.ribbonDamping;
        const gy = -GameConfig.ribbonGravity * dt * dt;

        for (let i = 1; i < n - 1; i++) {
            const px = pts[i].x;
            const py = pts[i].y;
            const vx = (px - prev[i].x) * damping;
            const vy = (py - prev[i].y) * damping + gy * 0.02;
            prev[i].set(px, py);
            pts[i].set(px + vx, py + vy);
        }

        pts[0].set(this._pinnedLeft);
        pts[n - 1].set(this._pinnedRight);

        const seg = this.ribbonWidth / (n - 1);
        for (let it = 0; it < iterations; it++) {
            for (let i = 0; i < n - 1; i++) {
                this._constraintSegment(i, i + 1, seg);
            }
            pts[0].set(this._pinnedLeft);
            pts[n - 1].set(this._pinnedRight);
        }
    }

    private _constraintSegment(i: number, j: number, rest: number): void {
        const a = this._points[i];
        const b = this._points[j];
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 0.0001;
        const diff = (dist - rest) / dist;
        const ox = dx * 0.5 * diff;
        const oy = dy * 0.5 * diff;
        if (i !== 0) {
            a.x += ox;
            a.y += oy;
        }
        if (j !== this._points.length - 1) {
            b.x -= ox;
            b.y -= oy;
        }
    }

    private _drawRibbon(): void {
        const g = this._graphics;
        if (!g) {
            return;
        }
        g.clear();
        g.lineWidth = this.lineWidth;
        g.strokeColor = this.ropeColor;
        const pts = this._points;
        if (pts.length === 0) {
            return;
        }
        g.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
            g.lineTo(pts[i].x, pts[i].y);
        }
        g.stroke();
    }

    private _checkWin(): void {
        if (!this.playerNode || !this.flowTarget) {
            return;
        }
        const pUi = this.playerNode.getComponent(UITransform);
        const tNode = this.triggerNode ?? this.node;
        const tUi = tNode.getComponent(UITransform);
        if (!pUi || !tUi) {
            return;
        }
        const a = pUi.getBoundingBoxToWorld();
        const b = tUi.getBoundingBoxToWorld();
        if (a.intersects(b)) {
            this._won = true;
            this.flowTarget.notifyWin();
        }
    }
}
