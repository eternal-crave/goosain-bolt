import { _decorator, Component, EventTarget } from 'cc';
import { GameConfig } from '../config/GameConfig';

const { ccclass } = _decorator;

export const PLAYER_HEALTH_CHANGED = 'player-health-changed';
export const PLAYER_DAMAGED = 'player-damaged';

/**
 * Run HP; GameFlow resets each run / menu. Wire HealthHud to onHealthChanged; wire PlayerDamageFlash to onDamaged for hit feedback.
 * Editor: add component on a persistent node (e.g. same root as GameFlow), assign that reference on GameFlow.playerHealth.
 */
@ccclass('PlayerHealth')
export class PlayerHealth extends Component {
    private _max = GameConfig.startingHealth;
    private _current = GameConfig.startingHealth;
    private readonly _events = new EventTarget();

    public get max(): number {
        return this._max;
    }

    public get current(): number {
        return this._current;
    }

    public onHealthChanged(callback: () => void, target?: unknown): void {
        this._events.on(PLAYER_HEALTH_CHANGED, callback, target);
    }

    public offHealthChanged(callback: () => void, target?: unknown): void {
        this._events.off(PLAYER_HEALTH_CHANGED, callback, target);
    }

    public onDamaged(callback: () => void, target?: unknown): void {
        this._events.on(PLAYER_DAMAGED, callback, target);
    }

    public offDamaged(callback: () => void, target?: unknown): void {
        this._events.off(PLAYER_DAMAGED, callback, target);
    }

    public reset(): void {
        this._max = GameConfig.startingHealth;
        this._current = this._max;
        this._emitChanged();
    }

    /** @returns true when HP is 0 or below after applying damage. */
    public applyDamage(amount: number): boolean {
        if (amount <= 0 || !Number.isFinite(amount)) {
            return this._current <= 0;
        }
        const before = this._current;
        this._current = Math.max(0, this._current - Math.floor(amount));
        if (this._current < before) {
            this._events.emit(PLAYER_DAMAGED);
        }
        this._emitChanged();
        return this._current <= 0;
    }

    private _emitChanged(): void {
        this._events.emit(PLAYER_HEALTH_CHANGED);
    }
}
