import { _decorator, Component, instantiate, Node, Prefab, randomRange, view, View } from 'cc';
import { GameConfig } from '../config/GameConfig';
import { FinishRibbon } from '../finish/FinishRibbon';
import { FinishZone } from '../finish/FinishZone';
import { Obstacle } from './Obstacle';
import { ObjectPool } from './ObjectPool';

const { ccclass, property } = _decorator;

@ccclass('Spawner')
export class Spawner extends Component {
    @property(Prefab)
    public obstaclePrefab: Prefab | null = null;

    @property(Prefab)
    public finishPrefab: Prefab | null = null;

    @property(Node)
    public obstacleParent: Node | null = null;

    private _pool: ObjectPool | null = null;
    private _spawnTimer = 0;
    private _nextSpawnAt = 0.6;
    private _spawningObstacles = false;
    private _runSpeed = 0;
    private _finishSpawned = false;
    private _finishNode: Node | null = null;
    private readonly _active: Node[] = [];
    private _dynamicRecycleX = GameConfig.recycleX;

    public onLoad(): void {
        if (this.obstaclePrefab && this.obstacleParent) {
            this._pool = new ObjectPool(this.obstaclePrefab, this.obstacleParent, GameConfig.poolSize);
        }
        view.on('canvas-resize', this._onCanvasResize, this);
        this._recomputeRecycleThreshold();
    }

    public onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResize, this);
    }

    public resetForNewRun(): void {
        this.recycleAllObstacles();
        this._finishSpawned = false;
        this._spawnTimer = 0;
        this._scheduleNextSpawn();
        if (this._finishNode) {
            this._finishNode.destroy();
            this._finishNode = null;
        }
    }

    public setObstacleSpawning(enabled: boolean): void {
        this._spawningObstacles = enabled;
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
        if (this._finishNode) {
            const fo = this._finishNode.getComponent(Obstacle);
            if (fo) {
                fo.moveSpeed = speed;
            }
        }
    }

    public spawnFinishLine(): void {
        if (this._finishSpawned || !this.finishPrefab || !this.obstacleParent) {
            return;
        }
        this._finishSpawned = true;
        const n = instantiate(this.finishPrefab);
        n.setParent(this.obstacleParent);
        n.setPosition(GameConfig.spawnX, this._getObstacleSpawnBaseY(), 0);
        let obs = n.getComponent(Obstacle);
        if (!obs) {
            obs = n.addComponent(Obstacle);
        }
        obs.moveSpeed = this._runSpeed;
        const ribbon = n.getComponent(FinishRibbon);
        if (ribbon) {
            ribbon.destroy();
        }
        if (!n.getComponent(FinishZone)) {
            n.addComponent(FinishZone);
        }
        this._finishNode = n;
    }

    public getActiveObstacles(): readonly Node[] {
        return this._active;
    }

    public getFinishNode(): Node | null {
        return this._finishNode;
    }

    public update(dt: number): void {
        this._recycleOffscreen();
        if (!this._spawningObstacles || !this._pool) {
            return;
        }
        this._spawnTimer += dt;
        if (this._spawnTimer >= this._nextSpawnAt) {
            this._spawnTimer = 0;
            this._spawnOneObstacle();
            this._scheduleNextSpawn();
        }
    }

    public recycleAllObstacles(): void {
        if (!this._pool) {
            return;
        }
        for (const n of [...this._active]) {
            this._pool.put(n);
        }
        this._active.length = 0;
    }

    private _scheduleNextSpawn(): void {
        this._nextSpawnAt = randomRange(GameConfig.spawnIntervalMin, GameConfig.spawnIntervalMax);
    }

    private _onCanvasResize(): void {
        this._recomputeRecycleThreshold();
    }

    /**
     * Recycle threshold is computed in obstacle local space from current viewport width.
     * This keeps disappear timing stable when canvas size changes at runtime.
     */
    private _recomputeRecycleThreshold(): void {
        if (!this.obstacleParent || !this.obstacleParent.isValid) {
            this._dynamicRecycleX = GameConfig.recycleX;
            return;
        }
        const visible = View.instance.getVisibleSize();
        if (visible.width <= 0) {
            this._dynamicRecycleX = GameConfig.recycleX;
            return;
        }
        const scaleX = this.obstacleParent.worldScale.x;
        if (Math.abs(scaleX) <= 1e-5) {
            this._dynamicRecycleX = GameConfig.recycleX;
            return;
        }
        const parentWorldX = this.obstacleParent.worldPosition.x;
        const leftEdgeWorldX = -visible.width * 0.5;
        const recycleWorldX = leftEdgeWorldX - GameConfig.recycleViewportMargin;
        this._dynamicRecycleX = (recycleWorldX - parentWorldX) / scaleX;
    }

    private _spawnOneObstacle(): void {
        if (!this._pool || !this.obstacleParent) {
            return;
        }
        const jitter =
            GameConfig.obstacleYJitter > 0
                ? randomRange(-GameConfig.obstacleYJitter, GameConfig.obstacleYJitter)
                : 0;
        const y = this._getObstacleSpawnBaseY() + jitter;
        const node = this._pool.get();
        node.setPosition(GameConfig.spawnX, y, 0);
        const o = node.getComponent(Obstacle) ?? node.addComponent(Obstacle);
        o.moveSpeed = this._runSpeed;
        this._active.push(node);
    }

    /**
     * Obstacles are children of obstacleParent, so local Y=0 maps to the container baseline.
     * Move ObstacleContainer Y in scene to change ground height for all spawned obstacles.
     */
    private _getObstacleSpawnBaseY(): number {
        if (this.obstacleParent && this.obstacleParent.isValid) {
            return 0;
        }
        return GameConfig.obstacleY;
    }

    private _recycleOffscreen(): void {
        if (!this._pool) {
            return;
        }
        const recycleX = Number.isFinite(this._dynamicRecycleX) ? this._dynamicRecycleX : GameConfig.recycleX;
        for (let i = this._active.length - 1; i >= 0; i--) {
            const n = this._active[i];
            if (!n || !n.isValid) {
                this._active.splice(i, 1);
                continue;
            }
            if (n.position.x < recycleX) {
                this._pool.put(n);
                this._active.splice(i, 1);
            }
        }
    }
}
