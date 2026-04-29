import { _decorator, CCFloat, Color, Component, Sprite, Tween, tween } from 'cc';
import { PlayerHealth } from './PlayerHealth';

const { ccclass, property } = _decorator;

@ccclass('PlayerDamageFlash')
export class PlayerDamageFlash extends Component {
    @property({
        type: PlayerHealth,
        tooltip: 'Same PlayerHealth as GameFlow / HealthHud.',
    })
    public health: PlayerHealth | null = null;

    @property({
        type: Sprite,
        tooltip: 'Sprite to tint; if empty, uses Sprite on this node.',
    })
    public tintSprite: Sprite | null = null;

    @property({
        type: CCFloat,
        tooltip: 'Duration of each half step (toward tint or back to normal).',
    })
    public halfPulseSeconds = 0.08;

    @property({ tooltip: 'Peak tint while flashing damage.' })
    public damageTint = new Color(255, 140, 140, 255);

    private readonly _base = new Color(255, 255, 255, 255);

    public onLoad(): void {
        this._refreshBaseFromSprite();
    }

    public onEnable(): void {
        this.health?.onDamaged(this._onDamaged, this);
        this.health?.onHealthChanged(this._onHealthChanged, this);
        this._onHealthChanged();
    }

    public onDisable(): void {
        this._cancelFlash();
    }

    public onDestroy(): void {
        this._cancelFlash();
        this.health?.offDamaged(this._onDamaged, this);
        this.health?.offHealthChanged(this._onHealthChanged, this);
    }

    private _resolveSprite(): Sprite | null {
        return this.tintSprite ?? this.node.getComponent(Sprite);
    }

    private _refreshBaseFromSprite(): void {
        const s = this._resolveSprite();
        if (s) {
            this._base.set(s.color);
        }
    }

    private _onHealthChanged(): void {
        if (!this.health || this.health.current === this.health.max) {
            this._cancelFlash();
            this._refreshBaseFromSprite();
            this._restoreColor();
        }
    }

    private _onDamaged(): void {
        const s = this._resolveSprite();
        if (!s?.isValid) {
            return;
        }
        const d = this.halfPulseSeconds;
        Tween.stopAllByTarget(s);
        const base = this._base.clone();
        const tint = this.damageTint.clone();
        tween(s)
            .to(d, { color: tint })
            .to(d, { color: base.clone() })
            .to(d, { color: tint.clone() })
            .to(d, { color: base.clone() })
            .start();
    }

    private _cancelFlash(): void {
        const s = this._resolveSprite();
        if (s?.isValid) {
            Tween.stopAllByTarget(s);
        }
    }

    private _restoreColor(): void {
        const s = this._resolveSprite();
        if (s?.isValid) {
            s.color = this._base.clone();
        }
    }
}
