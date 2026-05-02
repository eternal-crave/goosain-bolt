import { _decorator, Component } from 'cc';
import { ConfettiEffect } from './ConfettiEffect';

const { ccclass, property } = _decorator;

@ccclass('ConfettiManager')
export class ConfettiManager extends Component {

    @property({ type: [ConfettiEffect], tooltip: 'All confetti effects placed in the scene.' })
    private effects: ConfettiEffect[] = [];

    private static _instance: ConfettiManager | null = null;

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    onLoad(): void {
        ConfettiManager._instance = this;
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
        for (const effect of this.effects) {
            effect.play();
        }
    }
}
