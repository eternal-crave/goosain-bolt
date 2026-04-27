import { _decorator, Component, instantiate, Node, Prefab, randomRange } from 'cc';
import { GameConfig } from '../config/GameConfig';
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

    public onLoad(): void {
        if (this.obstaclePrefab && this.obstacleParent) {
            this._pool = new ObjectPool(this.obstaclePrefab, this.obstacleParent, GameConfig.poolSize);
        }
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
        n.setPosition(0, GameConfig.spawnY, 0);
        let obs = n.getComponent(Obstacle);
        if (!obs) {
            obs = n.addComponent(Obstacle);
        }
        obs.moveSpeed = this._runSpeed;
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

    private _spawnOneObstacle(): void {
        if (!this._pool || !this.obstacleParent) {
            return;
        }
        const lane = (Math.random() * 3) | 0;
        const laneXs = GameConfig.laneXs;
        const x = laneXs[lane as 0 | 1 | 2] ?? 0;
        const node = this._pool.get();
        node.setPosition(x, GameConfig.spawnY, 0);
        const o = node.getComponent(Obstacle) ?? node.addComponent(Obstacle);
        o.moveSpeed = this._runSpeed;
        this._active.push(node);
    }

    private _recycleOffscreen(): void {
        if (!this._pool) {
            return;
        }
        for (let i = this._active.length - 1; i >= 0; i--) {
            const n = this._active[i];
            if (!n || !n.isValid) {
                this._active.splice(i, 1);
                continue;
            }
            if (n.position.y < GameConfig.recycleY) {
                this._pool.put(n);
                this._active.splice(i, 1);
            }
        }
    }
}
