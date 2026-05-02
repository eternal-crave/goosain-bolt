import { _decorator, Component, ParticleSystem2D } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ConfettiEffect')
export class ConfettiEffect extends Component {

    @property({ type: [ParticleSystem2D], tooltip: 'All particle emitters — one per confetti sprite.' })
    private emitters: ParticleSystem2D[] = [];

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    play(): void {
        for (const emitter of this.emitters) {
            emitter.resetSystem();
            emitter.autoRemoveOnFinish = false;
        }
        this.scheduleOnce(this._destroySelf, this._burstDuration());
    }

    stop(): void {
        for (const emitter of this.emitters) {
            emitter.stopSystem();
        }
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    private _burstDuration(): number {
        if (this.emitters.length === 0) return 0;
        const e = this.emitters[0];
        return e.life + e.lifeVar + 0.2;
    }

    private _destroySelf(): void {
        this.node.destroy();
    }
}
