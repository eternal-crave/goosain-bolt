import { _decorator, CCFloat, Component, easing, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { Obstacle } from '../game/Obstacle';

const { ccclass, property } = _decorator;

/**
 * Idle sway on two ribbon halves + liquid split tween + fade when {@link playSplit} runs (from GameFlow on finish overlap).
 */
@ccclass('FinishRibbon')
export class FinishRibbon extends Component {
    @property(Node)
    public leftHalf: Node | null = null;

    @property(Node)
    public rightHalf: Node | null = null;

    @property({ type: CCFloat, tooltip: 'Degrees peak sway per half.' })
    public swayAmplitudeDeg = 4;

    @property({ type: CCFloat, tooltip: 'Angular frequency for idle rope motion.' })
    public swaySpeed = 2.2;

    @property({
        type: CCFloat,
        tooltip: 'Phase difference between halves (multiplies π).',
    })
    public swayPhaseShift = 0.85;

    @property({ type: CCFloat })
    public splitDuration = 0.55;

    @property({
        type: CCFloat,
        tooltip: 'Fraction of splitDuration spent on sag / arc phase A (rest is settle phase B).',
    })
    public splitPhaseRatio = 0.42;

    @property({
        type: CCFloat,
        tooltip:
            'Extra local X at chord midpoint (signed); left half adds this value, right half subtracts (bend toward each pole).',
    })
    public liquidSagOffsetX = 0;

    @property({
        type: CCFloat,
        tooltip: 'Extra local Y at chord midpoint (usually negative = sag downward in UI space).',
    })
    public liquidSagOffsetY = -48;

    @property({ type: CCFloat, tooltip: 'Local X offset for left half end pose.' })
    public leftSplitOffsetX = -72;

    @property({ type: CCFloat, tooltip: 'Local Y offset for left half end pose.' })
    public leftSplitOffsetY = -140;

    @property({ type: CCFloat, tooltip: 'Extra degrees for left half at end of split.' })
    public leftSplitAngleDelta = -18;

    @property({ type: CCFloat, tooltip: 'Local X offset for right half end pose.' })
    public rightSplitOffsetX = 72;

    @property({ type: CCFloat, tooltip: 'Local Y offset for right half end pose.' })
    public rightSplitOffsetY = -140;

    @property({ type: CCFloat, tooltip: 'Extra degrees for right half at end of split.' })
    public rightSplitAngleDelta = 18;

    @property({
        type: CCFloat,
        tooltip: 'When fade starts as fraction of splitDuration from split start (0–1).',
    })
    public fadeStartRatio = 0.35;

    @property({ type: CCFloat, tooltip: 'Seconds to tween opacity to 0.' })
    public fadeDuration = 0.45;

    private _split = false;
    private _swayPhase = 0;
    private _baseLeftAngle = 0;
    private _baseRightAngle = 0;
    private readonly _tmpLeftPos = new Vec3();
    private readonly _tmpRightPos = new Vec3();
    private readonly _sagLeft = new Vec3();
    private readonly _sagRight = new Vec3();

    public onLoad(): void {
        this._captureBaseAngles();
    }

    public update(dt: number): void {
        if (this._split) {
            return;
        }
        const L = this.leftHalf;
        const R = this.rightHalf;
        if (!L?.isValid || !R?.isValid) {
            return;
        }
        this._swayPhase += dt * this.swaySpeed;
        const amp = this.swayAmplitudeDeg;
        L.angle = this._baseLeftAngle + Math.sin(this._swayPhase) * amp;
        R.angle =
            this._baseRightAngle +
            Math.sin(this._swayPhase + this.swayPhaseShift * Math.PI) * amp;
    }

    /** Called from GameFlow when the player overlaps the finish zone; safe to call multiple times. */
    public playSplit(): void {
        if (this._split) {
            return;
        }
        this._split = true;

        const obs = this.node.getComponent(Obstacle);
        if (obs) {
            obs.moveSpeed = 0;
        }

        const L = this.leftHalf;
        const R = this.rightHalf;
        if (!L?.isValid || !R?.isValid) {
            return;
        }

        const opL = this._ensureUIOpacity(L);
        const opR = this._ensureUIOpacity(R);

        Tween.stopAllByTarget(L);
        Tween.stopAllByTarget(R);
        if (opL) {
            Tween.stopAllByTarget(opL);
        }
        if (opR) {
            Tween.stopAllByTarget(opR);
        }

        const total = this.splitDuration;
        const r = Math.min(1, Math.max(0.05, this.splitPhaseRatio));
        const t1 = total * r;
        const t2 = Math.max(0.001, total - t1);

        L.getPosition(this._tmpLeftPos);
        R.getPosition(this._tmpRightPos);

        const leftEnd = new Vec3(
            this._tmpLeftPos.x + this.leftSplitOffsetX,
            this._tmpLeftPos.y + this.leftSplitOffsetY,
            this._tmpLeftPos.z,
        );
        const rightEnd = new Vec3(
            this._tmpRightPos.x + this.rightSplitOffsetX,
            this._tmpRightPos.y + this.rightSplitOffsetY,
            this._tmpRightPos.z,
        );

        this._chordMidpoint(this._tmpLeftPos, leftEnd, this.liquidSagOffsetX, this.liquidSagOffsetY, this._sagLeft);
        this._chordMidpoint(this._tmpRightPos, rightEnd, -this.liquidSagOffsetX, this.liquidSagOffsetY, this._sagRight);

        const angL0 = L.angle;
        const angR0 = R.angle;
        const angLf = angL0 + this.leftSplitAngleDelta;
        const angRf = angR0 + this.rightSplitAngleDelta;
        const midAngL = angL0 + (angLf - angL0) * 0.5;
        const midAngR = angR0 + (angRf - angR0) * 0.5;

        tween(L)
            .to(t1, { position: this._sagLeft, angle: midAngL }, { easing: easing.sineIn })
            .to(t2, { position: leftEnd, angle: angLf }, { easing: easing.cubicOut })
            .start();

        tween(R)
            .to(t1, { position: this._sagRight, angle: midAngR }, { easing: easing.sineIn })
            .to(t2, { position: rightEnd, angle: angRf }, { easing: easing.cubicOut })
            .start();

        const fadeDelay = Math.max(0, total * Math.min(1, Math.max(0, this.fadeStartRatio)));
        const fd = Math.max(0.01, this.fadeDuration);

        if (opL) {
            tween(opL).delay(fadeDelay).to(fd, { opacity: 0 }).start();
        }
        if (opR) {
            tween(opR).delay(fadeDelay).to(fd, { opacity: 0 }).start();
        }
    }

    private _ensureUIOpacity(node: Node): UIOpacity | null {
        let op = node.getComponent(UIOpacity);
        if (!op) {
            op = node.addComponent(UIOpacity);
            op.opacity = 255;
        }
        return op;
    }

    /** Mid-chord point plus sag offsets (local space). */
    private _chordMidpoint(a: Vec3, b: Vec3, sagX: number, sagY: number, out: Vec3): void {
        const u = 0.52;
        out.x = a.x + (b.x - a.x) * u + sagX;
        out.y = a.y + (b.y - a.y) * u + sagY;
        out.z = a.z + (b.z - a.z) * u;
    }

    private _captureBaseAngles(): void {
        if (this.leftHalf?.isValid) {
            this._baseLeftAngle = this.leftHalf.angle;
        }
        if (this.rightHalf?.isValid) {
            this._baseRightAngle = this.rightHalf.angle;
        }
    }
}
