import { _decorator, Component, Label } from 'cc';
import { CurrencyWallet } from './CurrencyWallet';

const { ccclass, property } = _decorator;

@ccclass('CurrencyHud')
export class CurrencyHud extends Component {
    @property(Label)
    public label: Label | null = null;

    @property(CurrencyWallet)
    public wallet: CurrencyWallet | null = null;

    public onLoad(): void {
        this.wallet?.onBalanceChanged(this._syncLabel, this);
        this._syncLabel();
    }

    public onDestroy(): void {
        this.wallet?.offBalanceChanged(this._syncLabel, this);
    }

    private _syncLabel(): void {
        if (!this.label || !this.wallet) {
            return;
        }
        this.label.string = `$${this.wallet.balance}`;
    }
}
