import {
    _decorator,
    Component,
    Node,
    Prefab,
    randomRange,
    Rect,
    UITransform,
    view,
    View,
} from 'cc';
import { GameConfig } from '../config/GameConfig';
import { Obstacle } from '../game/Obstacle';
import { ObjectPool } from '../game/ObjectPool';
import { PlayerController } from '../player/PlayerController';
import { CurrencyWallet } from './CurrencyWallet';
import { computeNormalizedLayoutYs, pickRandomLayoutStrategy } from './moneyLayouts';
import { MoneyPickup } from './MoneyPickup';

const { ccclass, property } = _decorator;

@ccclass('CurrencySpawner')
export class CurrencySpawner extends Component {
    @property([Prefab])
    public moneyPrefabs: Prefab[] = [];

    @property(Node)
    public moneyParent: Node | null = null;

    private _pools: ObjectPool[] = [];
    private readonly _nodeToPool = new WeakMap<Node, ObjectPool>();
    private readonly _active: Node[] = [];
    private _spawnTimer = 0;
    private _nextSpawnAt = 0.6;
    private _spawningMoney = false;
    private _runSpeed = 0;
    private _dynamicRecycleX = GameConfig.recycleX;

    public onLoad(): void {
        this._buildPools();
        view.on('canvas-resize', this._onCanvasResize, this);
        this._recomputeRecycleThreshold();
    }

    public onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResize, this);
    }

    public resetForNewRun(): void {
        this.recycleAllMoney();
        this._spawnTimer = 0;
        this._scheduleNextSpawn();
    }

    public setMoneySpawning(enabled: boolean): void {
        this._spawningMoney = enabled;
        if (!enabled) {
            this._spawnTimer = 0;
        }
    }

    public setRunSpeed(speed: number): void {
        this._runSpeed = speed;
        for (const n of this._active) {
            const o = n.getComponent(Obstacle);
            if (o) {
                o.moveSpeed = speed;
            }
        }
    }

    public update(dt: number): void {
        this._recycleOffscreen();
        if (!this._spawningMoney || this._pools.length === 0) {
            return;
        }
        this._spawnTimer += dt;
        if (this._spawnTimer >= this._nextSpawnAt) {
            this._spawnTimer = 0;
            this._spawnCluster();
            this._scheduleNextSpawn();
        }
    }

    public processCollection(player: PlayerController | null, wallet: CurrencyWallet | null): void {
        if (!player || !wallet) {
            return;
        }
        const playerBox = player.getWorldBounds();
        if (!playerBox) {
            return;
        }
        for (let i = this._active.length - 1; i >= 0; i--) {
            const n = this._active[i];
            if (!n || !n.isValid) {
                this._active.splice(i, 1);
                continue;
            }
            const moneyBox = this._getBestPickupWorldBounds(n);
            if (!moneyBox || !playerBox.intersects(moneyBox)) {
                continue;
            }
            const pickup = n.getComponent(MoneyPickup);
            wallet.add(pickup?.getCollectValue() ?? 1);
            this._returnToPool(n, i);
        }
    }

    public recycleAllMoney(): void {
        for (let i = this._active.length - 1; i >= 0; i--) {
            const n = this._active[i];
            if (n && n.isValid) {
                this._returnToPool(n, i);
            } else {
                this._active.splice(i, 1);
            }
        }
    }

    private _buildPools(): void {
        this._pools = [];
        if (!this.moneyParent || this.moneyPrefabs.length === 0) {
            return;
        }
        for (const prefab of this.moneyPrefabs) {
            if (!prefab) {
                continue;
            }
            this._pools.push(
                new ObjectPool(prefab, this.moneyParent, GameConfig.moneyPoolSizePerPrefab),
            );
        }
    }

    private _scheduleNextSpawn(): void {
        this._nextSpawnAt = randomRange(
            GameConfig.moneySpawnIntervalMin,
            GameConfig.moneySpawnIntervalMax,
        );
    }

    private _spawnCluster(): void {
        if (this._pools.length === 0 || !this.moneyParent) {
            return;
        }
        const lo = Math.min(GameConfig.moneyBillsMin, GameConfig.moneyBillsMax);
        const hi = Math.max(GameConfig.moneyBillsMin, GameConfig.moneyBillsMax);
        const count = Math.max(1, Math.floor(randomRange(lo, hi + 1)));
        const strategy = pickRandomLayoutStrategy();
        const normYs = computeNormalizedLayoutYs(strategy, count);
        const baseY = GameConfig.moneyBaselineLocalY;

        const cluster: Node[] = [];
        for (let i = 0; i < count; i++) {
            const pool = this._pickRandomPool();
            if (!pool) {
                this._releaseClusterNodes(cluster);
                return;
            }
            const node = pool.get();
            this._nodeToPool.set(node, pool);
            const pickup = node.getComponent(MoneyPickup);
            if (!pickup) {
                pool.put(node);
                this._releaseClusterNodes(cluster);
                return;
            }
            cluster.push(node);
        }

        const sizes = cluster.map((n) => this._getPickupLocalSize(n));
        const xs = this._computeClusterXs(sizes);
        const yScale = this._computeVerticalScale(normYs, sizes);

        for (let i = 0; i < cluster.length; i++) {
            const node = cluster[i]!;
            const x = xs[i] ?? GameConfig.spawnX;
            const y = baseY + (normYs[i] ?? 0) * yScale;
            node.setPosition(x, y, 0);
            let obs = node.getComponent(Obstacle);
            if (!obs) {
                obs = node.addComponent(Obstacle);
            }
            obs.moveSpeed = this._runSpeed;
            obs.speedScale = 1;
            node.getComponent(MoneyPickup)?.prepareForSpawn();
            this._active.push(node);
        }
    }

    private _releaseClusterNodes(nodes: Node[]): void {
        for (const node of nodes) {
            const pool = this._nodeToPool.get(node) ?? this._pools[0];
            pool?.put(node);
        }
        nodes.length = 0;
    }

    /** Width / height in money parent local space (content size × node scale). */
    private _getPickupLocalSize(node: Node): { w: number; h: number } {
        const ui = node.getComponent(UITransform) ?? node.getComponentInChildren(UITransform);
        if (!ui) {
            return { w: 64, h: 64 };
        }
        return {
            w: ui.contentSize.width * Math.abs(node.scale.x),
            h: ui.contentSize.height * Math.abs(node.scale.y),
        };
    }

    /**
     * Minimum gap between two pickup AABBs: half of each element's larger side (max of w,h).
     */
    private _pairEdgeGap(w0: number, h0: number, w1: number, h1: number): number {
        const s0 = Math.max(w0, h0);
        const s1 = Math.max(w1, h1);
        return 0.5 * s0 + 0.5 * s1;
    }

    /**
     * Center X per index: first at spawnX, then center distance ≥ half-widths + pair gap,
     * and at least `moneyStepX` between centers when that is larger.
     */
    private _computeClusterXs(sizes: ReadonlyArray<{ w: number; h: number }>): number[] {
        const xs: number[] = [];
        const spawnX = GameConfig.spawnX;
        const minCenterDx = GameConfig.moneyStepX;
        for (let i = 0; i < sizes.length; i++) {
            if (i === 0) {
                xs.push(spawnX);
                continue;
            }
            const prev = sizes[i - 1]!;
            const cur = sizes[i]!;
            const halfPrev = prev.w * 0.5;
            const halfCur = cur.w * 0.5;
            const gap = this._pairEdgeGap(prev.w, prev.h, cur.w, cur.h);
            const dx = Math.max(halfPrev + gap + halfCur, minCenterDx);
            xs.push((xs[i - 1] ?? spawnX) + dx);
        }
        return xs;
    }

    /**
     * Scale normalized Y shape so consecutive bills are separated by at least half-heights + gap,
     * and overall vertical spread is at least `moneyLayoutAmplitude` at peak |norm|.
     */
    private _computeVerticalScale(
        normYs: ReadonlyArray<number>,
        sizes: ReadonlyArray<{ w: number; h: number }>,
    ): number {
        let need = GameConfig.moneyLayoutAmplitude;
        const n = Math.min(normYs.length, sizes.length);
        for (let i = 1; i < n; i++) {
            const d = Math.abs((normYs[i] ?? 0) - (normYs[i - 1] ?? 0));
            if (d < 1e-5) {
                continue;
            }
            const a = sizes[i - 1]!;
            const b = sizes[i]!;
            const halfHa = a.h * 0.5;
            const halfHb = b.h * 0.5;
            const gap = this._pairEdgeGap(a.w, a.h, b.w, b.h);
            const minSep = halfHa + gap + halfHb;
            need = Math.max(need, minSep / d);
        }
        const peak = normYs.reduce((m, y) => Math.max(m, Math.abs(y)), 0);
        if (peak > 1e-5) {
            need = Math.max(need, GameConfig.moneyLayoutAmplitude / peak);
        }
        return need;
    }

    private _pickRandomPool(): ObjectPool | null {
        if (this._pools.length === 0) {
            return null;
        }
        return this._pools[Math.floor(Math.random() * this._pools.length)]!;
    }

    private _returnToPool(node: Node, activeIndex: number): void {
        const pool = this._nodeToPool.get(node) ?? this._pools[0];
        if (pool) {
            pool.put(node);
        }
        this._active.splice(activeIndex, 1);
    }

    private _recycleOffscreen(): void {
        if (this._pools.length === 0) {
            return;
        }
        const recycleX = Number.isFinite(this._dynamicRecycleX)
            ? this._dynamicRecycleX
            : GameConfig.recycleX;
        for (let i = this._active.length - 1; i >= 0; i--) {
            const n = this._active[i];
            if (!n || !n.isValid) {
                this._active.splice(i, 1);
                continue;
            }
            if (n.position.x < recycleX) {
                this._returnToPool(n, i);
            }
        }
    }

    private _onCanvasResize(): void {
        this._recomputeRecycleThreshold();
    }

    private _recomputeRecycleThreshold(): void {
        if (!this.moneyParent || !this.moneyParent.isValid) {
            this._dynamicRecycleX = GameConfig.recycleX;
            return;
        }
        const visible = View.instance.getVisibleSize();
        if (visible.width <= 0) {
            this._dynamicRecycleX = GameConfig.recycleX;
            return;
        }
        const scaleX = this.moneyParent.worldScale.x;
        if (Math.abs(scaleX) <= 1e-5) {
            this._dynamicRecycleX = GameConfig.recycleX;
            return;
        }
        const parentWorldX = this.moneyParent.worldPosition.x;
        const leftEdgeWorldX = -visible.width * 0.5;
        const recycleWorldX = leftEdgeWorldX - GameConfig.recycleViewportMargin;
        this._dynamicRecycleX = (recycleWorldX - parentWorldX) / scaleX;
    }

    private _getBestPickupWorldBounds(root: Node): Rect | null {
        const rootUi = root.getComponent(UITransform);
        let best = rootUi ? rootUi.getBoundingBoxToWorld() : null;
        const candidates = root.getComponentsInChildren(UITransform);
        for (const ui of candidates) {
            if (!ui.node.activeInHierarchy) {
                continue;
            }
            const next = ui.getBoundingBoxToWorld();
            if (next.width <= 0 || next.height <= 0) {
                continue;
            }
            if (!best || next.width * next.height < best.width * best.height) {
                best = next;
            }
        }
        return best;
    }
}
