import { _decorator, Component, ParticleSystem2D } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ConfettiEffect')
export class ConfettiEffect extends Component {

    @property({ type: [ParticleSystem2D], tooltip: 'All particle emitters for this confetti effect — one per sprite.' })
    private particleSystems: ParticleSystem2D[] = [];

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    play(): void {
        this.unschedule(this._disable);
        this.node.active = true;
        for (const ps of this.particleSystems) {
            ps.resetSystem();
        }
        this.scheduleOnce(this._disable, this._burstLifetime());
    }

    stop(): void {
        this.unschedule(this._disable);
        this._disable();
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    private _burstLifetime(): number {
        if (this.particleSystems.length === 0) return 0;
        const e = this.particleSystems[0];
        const emitDuration = e.duration >= 0 ? e.duration : 0;
        return emitDuration + e.life + e.lifeVar + 0.2;
    }

    private _disable(): void {
        for (const ps of this.particleSystems) {
            ps.stopSystem();
        }
        this.node.active = false;
    }
}
