import { _decorator, Component, ParticleSystem2D } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('ConfettiManager')
export class ConfettiManager extends Component {

    @property({ type: [ParticleSystem2D], tooltip: 'All confetti emitters placed in the scene.' })
    private emitters: ParticleSystem2D[] = [];

    private static _instance: ConfettiManager | null = null;

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    onLoad(): void {
        ConfettiManager._instance = this;
        this._disableAll();
    }

    onDestroy(): void {
        if (ConfettiManager._instance === this) {
            ConfettiManager._instance = null;
        }
    }

    // -------------------------------------------------------------------------
    // Static accessor
    // -------------------------------------------------------------------------

    static get instance(): ConfettiManager | null {
        return ConfettiManager._instance;
    }

    // -------------------------------------------------------------------------
    // Public API
    // -------------------------------------------------------------------------

    play(): void {
        this.unschedule(this._disableAll);
        for (const emitter of this.emitters) {
            emitter.node.active = true;
            emitter.resetSystem();
        }
        this.scheduleOnce(this._disableAll, this._burstLifetime());
    }

    // -------------------------------------------------------------------------
    // Private
    // -------------------------------------------------------------------------

    private _burstLifetime(): number {
        if (this.emitters.length === 0) return 0;
        const e = this.emitters[0];
        const emitDuration = e.duration >= 0 ? e.duration : 0;
        return emitDuration + e.life + e.lifeVar + 0.2;
    }

    private _disableAll(): void {
        for (const emitter of this.emitters) {
            emitter.stopSystem();
            emitter.node.active = false;
        }
    }
}
