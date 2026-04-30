import {
    _decorator,
    CCFloat,
    CCInteger,
    Color,
    Component,
    easing,
    Graphics,
    Node,
    tween,
    Tween,
    Vec3,
} from 'cc';

const { ccclass, property, executeInEditMode } = _decorator;

/**
 * Draws a sagging catenary rope between two anchor nodes using the Graphics API.
 *
 * Idle: gentle sine-wave sway.
 * Split: rope breaks at the midpoint — left half flies left+down, right half flies right+down,
 *        both fading out together.
 *
 * Add this component to a plain Node (RopeNode) that is a child of the FinishLine prefab root.
 * Wire leftAnchor and rightAnchor to the top-of-cone child nodes on each post.
 */
@ccclass('RopeRenderer')
@executeInEditMode(true)
export class RopeRenderer extends Component {
    // ─── Inspector fields ───────────────────────────────────────────────────

    @property({
        type: Node,
        tooltip: 'Empty child node at the tip of the left cone post.',
    })
    public leftAnchor: Node | null = null;

    @property({
        type: Node,
        tooltip: 'Empty child node at the tip of the right cone post.',
    })
    public rightAnchor: Node | null = null;

    @property({
        type: CCFloat,
        tooltip: 'How far the rope midpoint sags downward at rest (local pixels).',
    })
    public sagAmount = 90;

    @property({
        type: CCFloat,
        tooltip: 'Peak vertical sway in pixels during idle animation.',
    })
    public swayAmplitude = 14;

    @property({
        type: CCFloat,
        tooltip: 'Angular frequency of the idle sway (radians/s).',
    })
    public swaySpeed = 1.9;

    @property({
        type: CCInteger,
        tooltip: 'Number of line-segments used to draw the catenary (16–32 is ideal).',
        min: 4,
        max: 64,
    })
    public segments = 24;

    @property({
        type: CCFloat,
        tooltip: 'Stroke width of the rope in pixels.',
    })
    public ropeThickness = 6;

    @property({
        type: Color,
        tooltip: 'Rope stroke colour.',
    })
    public ropeColor: Color = new Color(232, 160, 32, 255);

    @property({
        type: CCFloat,
        tooltip: 'Seconds for each rope half to reach its end pose after splitting.',
    })
    public splitFlyDuration = 0.6;

    @property({
        type: CCFloat,
        tooltip: 'How far (pixels) each rope-end tip flies outward in X from the break point.',
    })
    public splitFlyOffsetX = 160;

    @property({
        type: CCFloat,
        tooltip: 'How far (pixels) each rope-end tip drops in Y from the break point.',
    })
    public splitDropY = 220;

    @property({
        type: CCFloat,
        tooltip: 'Duration for the fade-out that starts simultaneously with the fly (seconds).',
    })
    public splitFadeDuration = 0.7;

    // ─── Private state ───────────────────────────────────────────────────────

    private _graphics: Graphics | null = null;
    /** Current stroke alpha (255 → 0 during fade). Animated directly so Graphics picks it up. */
    private _alpha = 255;
    /** Reused Color to avoid per-frame allocation. */
    private readonly _currentColor = new Color();
    private _swayPhase = 0;
    private _split = false;
    private _splitProgress = 0;

    /** Catenary midpoint captured at the moment playSplit() fires. */
    private readonly _midLocal = new Vec3();
    /** Animated tip of the left half (starts at midpoint, flies left+down). */
    private readonly _leftSplitEnd = new Vec3();
    /** Animated tip of the right half (starts at midpoint, flies right+down). */
    private readonly _rightSplitEnd = new Vec3();

    private readonly _leftLocal = new Vec3();
    private readonly _rightLocal = new Vec3();

    // ─── Lifecycle ───────────────────────────────────────────────────────────

    public onLoad(): void {
        this._graphics = this._ensureGraphics();
        this._alpha = 255;
    }

    public update(dt: number): void {
        if (!this._graphics) {
            return;
        }
        if (!this._split) {
            this._swayPhase += dt * this.swaySpeed;
        } else {
            this._updateSplitTips();
        }
        this._drawRope();
    }

    // ─── Public API ──────────────────────────────────────────────────────────

    /** Called when the player crosses the finish line. Safe to call multiple times. */
    public playSplit(): void {
        if (this._split) {
            return;
        }
        this._split = true;
        this._splitProgress = 0;

        this._captureMidpoint();

        Tween.stopAllByTarget(this);

        const flyProg = { t: 0 };
        tween(flyProg)
            .to(this.splitFlyDuration, { t: 1 }, { easing: easing.cubicOut })
            .call(() => {
                this._splitProgress = 1;
            })
            .start();

        this.schedule(
            () => {
                this._splitProgress = flyProg.t;
            },
            0.016,
            Math.ceil(this.splitFlyDuration / 0.016),
        );

        const fadeProg = { a: 255 };
        tween(fadeProg)
            .to(this.splitFadeDuration, { a: 0 }, { easing: easing.sineIn })
            .call(() => {
                this._alpha = 0;
            })
            .start();

        this.schedule(
            () => {
                this._alpha = Math.round(fadeProg.a);
            },
            0.016,
            Math.ceil(this.splitFadeDuration / 0.016),
        );
    }

    // ─── Drawing ─────────────────────────────────────────────────────────────

    private _drawRope(): void {
        const g = this._graphics;
        if (!g) {
            return;
        }

        const lPos = this._resolveAnchorLocal(this.leftAnchor, this._leftLocal);
        const rPos = this._resolveAnchorLocal(this.rightAnchor, this._rightLocal);
        if (!lPos || !rPos) {
            return;
        }

        this._currentColor.set(
            this.ropeColor.r,
            this.ropeColor.g,
            this.ropeColor.b,
            this._alpha,
        );

        g.clear();
        g.lineWidth = this.ropeThickness;
        g.strokeColor = this._currentColor;
        g.lineCap = Graphics.LineCap.ROUND;
        g.lineJoin = Graphics.LineJoin.ROUND;

        if (!this._split) {
            this._strokeFullRope(g, lPos, rPos);
        } else {
            this._strokeLeftHalf(g, lPos);
            this._strokeRightHalf(g, rPos);
        }
    }

    /** Single continuous catenary from left to right anchor (idle state). */
    private _strokeFullRope(g: Graphics, lPos: Vec3, rPos: Vec3): void {
        const swayOffset = Math.sin(this._swayPhase) * this.swayAmplitude;
        const n = Math.max(2, this.segments);

        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const pt = this._catenaryPoint(t, lPos, rPos, this.sagAmount, swayOffset);
            if (i === 0) {
                g.moveTo(pt.x, pt.y);
            } else {
                g.lineTo(pt.x, pt.y);
            }
        }
        g.stroke();
    }

    /** Left half: from leftAnchor to the animated break-tip. */
    private _strokeLeftHalf(g: Graphics, lPos: Vec3): void {
        const rPos = this._leftSplitEnd;
        const n = Math.max(2, Math.floor(this.segments / 2));

        for (let i = 0; i <= n; i++) {
            const t = i / n;
            // The left half covers the original t range [0, 0.5]; use full-rope sag scaled to half.
            const pt = this._catenaryPoint(t * 0.5, lPos, this._midLocal, this.sagAmount, 0);
            // Blend endpoint toward the flying tip
            if (i === n) {
                g.lineTo(rPos.x, rPos.y);
            } else if (i === 0) {
                g.moveTo(pt.x, pt.y);
            } else {
                g.lineTo(pt.x, pt.y);
            }
        }
        g.stroke();
    }

    /** Right half: from the animated break-tip to rightAnchor. */
    private _strokeRightHalf(g: Graphics, rPos: Vec3): void {
        const lPos = this._rightSplitEnd;
        const n = Math.max(2, Math.floor(this.segments / 2));

        for (let i = 0; i <= n; i++) {
            const t = i / n;
            // The right half covers original t range [0.5, 1].
            const pt = this._catenaryPoint(0.5 + t * 0.5, this._midLocal, rPos, this.sagAmount, 0);
            if (i === 0) {
                g.moveTo(lPos.x, lPos.y);
            } else if (i === n) {
                g.lineTo(pt.x, pt.y);
            } else {
                g.lineTo(pt.x, pt.y);
            }
        }
        g.stroke();
    }

    // ─── Split tip animation ──────────────────────────────────────────────────

    private _captureMidpoint(): void {
        const lPos = this._resolveAnchorLocal(this.leftAnchor, this._leftLocal);
        const rPos = this._resolveAnchorLocal(this.rightAnchor, this._rightLocal);
        if (!lPos || !rPos) {
            return;
        }
        // Catenary midpoint at t=0.5, no sway
        const mid = this._catenaryPoint(0.5, lPos, rPos, this.sagAmount, 0);
        this._midLocal.set(mid.x, mid.y, 0);
        this._leftSplitEnd.set(mid.x, mid.y, 0);
        this._rightSplitEnd.set(mid.x, mid.y, 0);
    }

    private _updateSplitTips(): void {
        const p = this._splitProgress;
        this._leftSplitEnd.set(
            this._midLocal.x - this.splitFlyOffsetX * p,
            this._midLocal.y - this.splitDropY * p,
            0,
        );
        this._rightSplitEnd.set(
            this._midLocal.x + this.splitFlyOffsetX * p,
            this._midLocal.y - this.splitDropY * p,
            0,
        );
    }

    // ─── Helpers ─────────────────────────────────────────────────────────────

    /**
     * Returns a point on the catenary at parameter t (0–1) between two endpoints.
     * Uses a parabola approximation: sag peaks at t=0.5.
     */
    private _catenaryPoint(t: number, a: Vec3, b: Vec3, sag: number, swayY: number): Vec3 {
        const x = a.x + (b.x - a.x) * t;
        const baseY = a.y + (b.y - a.y) * t;
        const sagY = sag * 4 * t * (1 - t) + swayY * Math.sin(t * Math.PI);
        this._pt.set(x, baseY - sagY, 0);
        return this._pt;
    }

    private readonly _pt = new Vec3();

    /**
     * Resolves an anchor node's world position into the coordinate space of
     * this component's node (so Graphics draws correctly in local space).
     */
    private _resolveAnchorLocal(anchor: Node | null, out: Vec3): Vec3 | null {
        if (!anchor || !anchor.isValid) {
            return null;
        }
        const world = anchor.worldPosition;
        this.node.inverseTransformPoint(out, world);
        return out;
    }

    private _ensureGraphics(): Graphics {
        let g = this.node.getComponent(Graphics);
        if (!g) {
            g = this.node.addComponent(Graphics);
        }
        return g;
    }
}
