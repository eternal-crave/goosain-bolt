import { _decorator, AudioClip, AudioSource, CCFloat, Component } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('GameSfx')
export class GameSfx extends Component {
    @property(AudioClip)
    public jumpClip: AudioClip | null = null;

    @property(AudioClip)
    public currencyCollectClip: AudioClip | null = null;

    @property(AudioClip)
    public damageClip: AudioClip | null = null;

    @property(AudioClip)
    public finishClip: AudioClip | null = null;

    @property(AudioClip)
    public loseClip: AudioClip | null = null;

    @property({
        type: AudioClip,
        tooltip: 'Looping music while a run is active (stopped on win / lose / menu).',
    })
    public bgmClip: AudioClip | null = null;

    @property({
        type: AudioSource,
        tooltip: 'Optional; if empty, uses or adds AudioSource on this node.',
    })
    public audioSource: AudioSource | null = null;

    @property({
        type: AudioSource,
        tooltip:
            'Separate channel for BGM; should not be the same component as SFX AudioSource. If empty, adds or picks another AudioSource on this node.',
    })
    public bgmAudioSource: AudioSource | null = null;

    @property({
        type: CCFloat,
        tooltip: 'Multiplier passed to playOneShot volume scale.',
    })
    public sfxVolumeScale = 1;

    @property({
        type: CCFloat,
        tooltip: 'Linear volume for BGM (0–1 typical).',
    })
    public bgmVolume = 1;

    private _resolvedAudio: AudioSource | null = null;

    private _resolvedBgmAudio: AudioSource | null = null;

    public onLoad(): void {
        let src: AudioSource | null = this.audioSource?.isValid ? this.audioSource : null;
        if (!src) {
            src = this.getComponent(AudioSource);
        }
        if (!src) {
            src = this.node.addComponent(AudioSource);
            src.playOnAwake = false;
            src.loop = false;
        }
        this._resolvedAudio = src;
        this._resolveBgmAudioSource();
    }

    /**
     * Looping run music: active while Playing; stops when returning to menu or on win/lose.
     */
    public setRunBgmActive(active: boolean): void {
        const bgm = this._resolvedBgmAudio;
        const clip = this.bgmClip;
        if (!bgm) {
            return;
        }
        if (!active || !clip) {
            bgm.stop();
            return;
        }
        const vol = Number.isFinite(this.bgmVolume) ? Math.max(0, this.bgmVolume) : 1;
        bgm.volume = vol;
        bgm.loop = true;
        if (bgm.clip !== clip) {
            bgm.clip = clip;
        }
        if (!bgm.playing) {
            bgm.play();
        }
    }

    public playJump(): void {
        this._playClip(this.jumpClip);
    }

    public playCurrencyCollect(): void {
        this._playClip(this.currencyCollectClip);
    }

    public playDamage(): void {
        this._playClip(this.damageClip);
    }

    public playFinish(): void {
        this._playClip(this.finishClip);
    }

    public playLose(): void {
        this._playClip(this.loseClip);
    }

    private _playClip(clip: AudioClip | null): void {
        if (!clip || !this._resolvedAudio) {
            return;
        }
        const scale = Number.isFinite(this.sfxVolumeScale) ? Math.max(0, this.sfxVolumeScale) : 1;
        this._resolvedAudio.playOneShot(clip, scale);
    }

    private _resolveBgmAudioSource(): void {
        let bgm: AudioSource | null = this.bgmAudioSource?.isValid ? this.bgmAudioSource : null;
        if (!bgm && this._resolvedAudio) {
            const sources = this.node.getComponents(AudioSource);
            bgm = sources.find((s) => s !== this._resolvedAudio) ?? null;
        }
        if (!bgm) {
            bgm = this.node.addComponent(AudioSource);
            bgm.playOnAwake = false;
        }
        bgm.loop = true;
        this._resolvedBgmAudio = bgm;
    }
}
