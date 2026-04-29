import { _decorator, Animation, AnimationState, Component } from 'cc';

const { ccclass, property } = _decorator;

enum VisualPhase {
    Idle = 0,
    Running = 1,
    Jumping = 2,
    Landing = 3,
}

@ccclass('PlayerVisualAnimator')
export class PlayerVisualAnimator extends Component {
    @property({ tooltip: 'Animation component on this node (optional; auto-resolved if empty).' })
    public animationTarget: Animation | null = null;

    @property({ tooltip: 'Clip name for run loop (wrap mode Loop in clip asset).' })
    public runClipName = 'GirlRun';

    @property({ tooltip: 'Clip name for jump (one-shot).' })
    public jumpClipName = 'GirlJump';

    @property({ tooltip: 'Clip name for landing (one-shot); if empty or missing, goes straight to run.' })
    public landClipName = 'GirlLand';

    private _anim: Animation | null = null;
    private _phase = VisualPhase.Idle;

    public onLoad(): void {
        this._anim = this.animationTarget ?? this.getComponent(Animation);
        this._anim?.on(Animation.EventType.FINISHED, this._onAnimationFinished, this);
    }

    public onDestroy(): void {
        this._anim?.off(Animation.EventType.FINISHED, this._onAnimationFinished, this);
    }

    /** Call when a run session starts (after tap to start). */
    public enterRunning(): void {
        this._phase = VisualPhase.Running;
        this._playClipOrFallback(this.runClipName, this.runClipName);
    }

    /** Call when returning to menu / win / lose — stops playback. */
    public resetToIdle(): void {
        this._phase = VisualPhase.Idle;
        this._anim?.stop();
    }

    /** Call when gameplay applies an upward jump. */
    public notifyJump(): void {
        if (this._phase === VisualPhase.Idle) {
            return;
        }
        this._phase = VisualPhase.Jumping;
        this._playClipOrFallback(this.jumpClipName, this.runClipName);
    }

    /** Call once on landing edge (air to ground). */
    public notifyLanded(): void {
        if (this._phase === VisualPhase.Idle) {
            return;
        }
        this._phase = VisualPhase.Landing;
        if (this.landClipName && this._clipExists(this.landClipName)) {
            this._playClipOrFallback(this.landClipName, this.runClipName);
        } else {
            this.enterRunning();
        }
    }

    private _clipExists(clipName: string): boolean {
        if (!this._anim) {
            return false;
        }
        return this._anim.clips.some((c) => c && c.name === clipName);
    }

    private _playClipOrFallback(primary: string, fallback: string): void {
        if (!this._anim) {
            return;
        }
        const name = this._clipExists(primary) ? primary : fallback;
        if (!this._clipExists(name)) {
            return;
        }
        this._anim.play(name);
    }

    private _onAnimationFinished(_evt: unknown, state: AnimationState): void {
        if (this._phase !== VisualPhase.Landing) {
            return;
        }
        const finishedName = state?.clip?.name ?? state?.name;
        if (finishedName === this.landClipName) {
            this.enterRunning();
        }
    }
}
