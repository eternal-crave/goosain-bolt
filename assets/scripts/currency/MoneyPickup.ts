import { _decorator, CCInteger, Component } from 'cc';

const { ccclass, property } = _decorator;

@ccclass('MoneyPickup')
export class MoneyPickup extends Component {
    @property({ type: CCInteger, tooltip: 'Award when randomizeOnSpawn is false.' })
    public value = 5;

    @property({
        tooltip: 'If true, rolls valueMin..valueMax (inclusive) each time the instance is taken from the pool.',
    })
    public randomizeOnSpawn = false;

    @property({ type: CCInteger })
    public valueMin = 1;

    @property({ type: CCInteger })
    public valueMax = 10;

    private _resolvedValue = 0;

    public prepareForSpawn(): void {
        if (this.randomizeOnSpawn) {
            const lo = Math.min(this.valueMin, this.valueMax);
            const hi = Math.max(this.valueMin, this.valueMax);
            this._resolvedValue = lo + Math.floor(Math.random() * (hi - lo + 1));
        } else {
            this._resolvedValue = this.value;
        }
    }

    public getCollectValue(): number {
        return this._resolvedValue > 0 ? this._resolvedValue : this.value;
    }
}
