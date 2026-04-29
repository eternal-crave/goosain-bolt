import { _decorator, CCFloat, Component, Label, Node, Tween, tween, UIOpacity, Vec3 } from 'cc';
import { CurrencyWallet } from '../currency/CurrencyWallet';

const { ccclass, property } = _decorator;

const PULSE_HALF_SEC = 0.45;
const PULSE_SCALE = 1.06;

@ccclass('LoseUi')
export class LoseUi extends Component {
    @property({
        type: CurrencyWallet,
        tooltip: 'Same wallet as CurrencyHud / GameFlow for collected run earnings.',
    })
    public wallet: CurrencyWallet | null = null;

    @property(Label)
    public labelTitle: Label | null = null;

    @property(Label)
    public labelSubtitle: Label | null = null;

    @property(Label)
    public labelCardAmount: Label | null = null;

    @property({
        type: Label,
        tooltip: 'Optional HUD-style amount (e.g. top-right); leave empty if unused.',
    })
    public labelTopBarAmount: Label | null = null;

    @property({
        type: Node,
        tooltip: 'Root node for INSTALL CTA; receives scale pulse.',
    })
    public ctaNode: Node | null = null;

    @property({
        type: Node,
        tooltip:
            'Optional root for intro: fades in (UIOpacity) and scales small → peak → medium. Money label stays hidden until intro finishes. Leave empty to skip.',
    })
    public introRevealTarget: Node | null = null;

    @property({
        type: CCFloat,
        tooltip: 'Starting uniform scale for introRevealTarget.',
    })
    public introScaleSmall = 0.45;

    @property({
        type: CCFloat,
        tooltip: 'Overshoot scale before settling to medium.',
    })
    public introScalePeak = 1.12;

    @property({
        type: CCFloat,
        tooltip: 'Final resting uniform scale after intro.',
    })
    public introScaleMedium = 1;

    @property({
        type: CCFloat,
        tooltip: 'Seconds: fade in + grow from small to peak.',
    })
    public introDurationUp = 0.35;

    @property({
        type: CCFloat,
        tooltip: 'Seconds: scale from peak down to medium.',
    })
    public introDurationSettle = 0.22;

    @property({
        type: Node,
        tooltip: 'Optional child on LosePanel: spins while the panel is open; leave empty to skip.',
    })
    public rotateWhileOpenTarget: Node | null = null;

    @property({
        type: CCFloat,
        tooltip:
            'Rotation speed in degrees per second on rotateWhileOpenTarget (e.g. 120 = one full turn every 3 s). Use a negative value to spin the other way.',
    })
    public rotateWhileOpenDegreesPerSecond = 120;

    private _ctaBaseScale = new Vec3(1, 1, 1);

    public onEnable(): void {
        this.wallet?.onBalanceChanged(this._syncAmountLabels, this);
        this._stopIntroEffects();
        if (this.introRevealTarget?.isValid) {
            if (this.labelCardAmount?.node) {
                this.labelCardAmount.node.active = false;
            }
            this._syncAmountLabels();
            this._playIntroReveal();
        } else {
            if (this.labelCardAmount?.node) {
                this.labelCardAmount.node.active = true;
            }
            this._syncAmountLabels();
            this._startCtaPulse();
        }
        this._startRotateWhileOpen();
    }

    public onDisable(): void {
        this.wallet?.offBalanceChanged(this._syncAmountLabels, this);
        this._stopRotateWhileOpen();
        this._stopCtaPulse();
        this._stopIntroEffects();
        this._resetIntroVisuals();
        if (this.labelCardAmount?.node) {
            this.labelCardAmount.node.active = true;
        }
    }

    public onDestroy(): void {
        this.wallet?.offBalanceChanged(this._syncAmountLabels, this);
        this._stopRotateWhileOpen();
        this._stopCtaPulse();
        this._stopIntroEffects();
    }

    private _syncAmountLabels(): void {
        const text = this._formatMoney(this.wallet?.balance ?? 0);
        if (this.labelCardAmount) {
            this.labelCardAmount.string = text;
        }
        if (this.labelTopBarAmount) {
            this.labelTopBarAmount.string = text;
        }
    }

    private _formatMoney(amount: number): string {
        const safe = Number.isFinite(amount) ? Math.max(0, Math.floor(amount)) : 0;
        return `$${safe.toFixed(2)}`;
    }

    private _getOrAddUiOpacity(node: Node): UIOpacity {
        return node.getComponent(UIOpacity) ?? node.addComponent(UIOpacity);
    }

    private _stopIntroEffects(): void {
        const n = this.introRevealTarget;
        if (!n?.isValid) {
            return;
        }
        Tween.stopAllByTarget(n);
        const op = n.getComponent(UIOpacity);
        if (op) {
            Tween.stopAllByTarget(op);
        }
    }

    private _resetIntroVisuals(): void {
        const n = this.introRevealTarget;
        if (!n?.isValid) {
            return;
        }
        const op = n.getComponent(UIOpacity);
        if (op) {
            op.opacity = 255;
        }
        const m = Math.max(0.001, this.introScaleMedium);
        n.setScale(m, m, 1);
    }

    private _playIntroReveal(): void {
        const node = this.introRevealTarget;
        if (!node?.isValid) {
            this._onIntroComplete();
            return;
        }
        const opacity = this._getOrAddUiOpacity(node);
        opacity.opacity = 0;

        const small = Math.max(0.001, this.introScaleSmall);
        const peak = Math.max(0.001, this.introScalePeak);
        const medium = Math.max(0.001, this.introScaleMedium);
        node.setScale(small, small, 1);

        const peakVec = new Vec3(peak, peak, 1);
        const mediumVec = new Vec3(medium, medium, 1);

        const up = Math.max(0.01, this.introDurationUp);
        const settle = Math.max(0.01, this.introDurationSettle);

        tween(opacity).to(up, { opacity: 255 }).start();

        tween(node)
            .to(up, { scale: peakVec })
            .to(settle, { scale: mediumVec })
            .call(() => this._onIntroComplete())
            .start();
    }

    private _onIntroComplete(): void {
        if (this.labelCardAmount?.node) {
            this.labelCardAmount.node.active = true;
        }
        this._syncAmountLabels();
        this._startCtaPulse();
    }

    private _startCtaPulse(): void {
        const target = this.ctaNode;
        if (!target || !target.isValid) {
            return;
        }
        this._stopCtaPulse();
        this._ctaBaseScale.set(target.scale);
        const peak = new Vec3(
            this._ctaBaseScale.x * PULSE_SCALE,
            this._ctaBaseScale.y * PULSE_SCALE,
            this._ctaBaseScale.z,
        );
        tween(target)
            .to(PULSE_HALF_SEC, { scale: peak })
            .to(PULSE_HALF_SEC, { scale: this._ctaBaseScale.clone() })
            .union()
            .repeatForever()
            .start();
    }

    private _stopCtaPulse(): void {
        const target = this.ctaNode;
        if (target && target.isValid) {
            Tween.stopAllByTarget(target);
        }
    }

    private _startRotateWhileOpen(): void {
        const target = this.rotateWhileOpenTarget;
        if (!target?.isValid) {
            return;
        }
        this._stopRotateWhileOpen();
        const signed = Number.isFinite(this.rotateWhileOpenDegreesPerSecond)
            ? this.rotateWhileOpenDegreesPerSecond
            : 120;
        const dps = Math.max(0.01, Math.abs(signed));
        const sec = 360 / dps;
        const step = signed >= 0 ? -360 : 360;
        tween(target).by(sec, { angle: step }).repeatForever().start();
    }

    private _stopRotateWhileOpen(): void {
        const target = this.rotateWhileOpenTarget;
        if (target?.isValid) {
            Tween.stopAllByTarget(target);
        }
    }
}
