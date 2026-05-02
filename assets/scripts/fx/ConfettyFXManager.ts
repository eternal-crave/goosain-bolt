import { _decorator, Component } from 'cc';
import { ConfettyFX } from './ConfettyFX';

const { ccclass, property } = _decorator;

@ccclass('ConfettyFXManager')
export class ConfettyFXManager extends Component {

    @property({ type: [ConfettyFX], tooltip: 'All confetti effects placed in the scene.' })
    private effects: ConfettyFX[] = [];

    private static _instance: ConfettyFXManager | null = null;

    // -------------------------------------------------------------------------
    // Lifecycle
    // -------------------------------------------------------------------------

    onLoad(): void {
        ConfettyFXManager._instance = this;
    }

    onDestroy(): void {
        if (ConfettyFXManager._instance === this) {
            ConfettyFXManager._instance = null;
        }
    }

    // -------------------------------------------------------------------------
    // Static accessor
    // -------------------------------------------------------------------------

    static get instance(): ConfettyFXManager | null {
        return ConfettyFXManager._instance;
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
