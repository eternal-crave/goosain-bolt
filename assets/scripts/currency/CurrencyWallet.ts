import { _decorator, Component, EventTarget } from 'cc';

const { ccclass } = _decorator;

export const CURRENCY_WALLET_CHANGED = 'currency-wallet-changed';

@ccclass('CurrencyWallet')
export class CurrencyWallet extends Component {
    private _balance = 0;
    private readonly _events = new EventTarget();

    public get balance(): number {
        return this._balance;
    }

    public reset(): void {
        this._balance = 0;
        this._emitChanged();
    }

    public add(amount: number): void {
        if (amount <= 0 || !Number.isFinite(amount)) {
            return;
        }
        this._balance += Math.floor(amount);
        this._emitChanged();
    }

    public onBalanceChanged(callback: () => void, target?: unknown): void {
        this._events.on(CURRENCY_WALLET_CHANGED, callback, target);
    }

    public offBalanceChanged(callback: () => void, target?: unknown): void {
        this._events.off(CURRENCY_WALLET_CHANGED, callback, target);
    }

    private _emitChanged(): void {
        this._events.emit(CURRENCY_WALLET_CHANGED);
    }
}
