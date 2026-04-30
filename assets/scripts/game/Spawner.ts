import { _decorator, Canvas, Color, Component, Graphics, instantiate, Node, Prefab, randomRange, Vec3, view } from 'cc';
import { GameConfig } from '../config/GameConfig';
import { FinishZone } from '../finish/FinishZone';
import { Obstacle } from './Obstacle';
import { ObjectPool } from './ObjectPool';

const { ccclass, property } = _decorator;

@ccclass('Spawner')
export class Spawner extends Component {
    @property(Prefab)
    public obstaclePrefab: Prefab | null = null;

    @property(Prefab)
    public chargerObstaclePrefab: Prefab | null = null;

    @property(Prefab)
    public finishPrefab: Prefab | null = null;

    @property(Node)
    public obstacleParent: Node | null = null;

    @property({ tooltip: 'Draw spawn-edge debug circle every frame' })
    public debugDrawSpawnEdge = false;

    private _pool: ObjectPool | null = null;
    private _chargerPool: ObjectPool | null = null;
    private readonly _nodeToPool = new WeakMap<Node, ObjectPool>();
    private _spawnTimer = 0;
    private _nextSpawnAt = 0.6;
    private _spawningObstacles = false;
    private _runSpeed = 0;
    private _finishSpawned = false;
    private _finishNode: Node | null = null;
    private readonly _active: Node[] = [];
    private _dynamicRecycleX = GameConfig.recycleX;
    /** When false, obstacles stay on screen (e.g. lose / win) until run reset. */
    private _offscreenRecycleEnabled = true;
    private _canvas: Canvas | null = null;
    private readonly _screenProbe = new Vec3();
    private readonly _worldProbe = new Vec3();
    private _debugGraphics: Graphics | null = null;
    private readonly _debugLocalProbe = new Vec3();

    public onLoad(): void {
        if (this.obstaclePrefab && this.obstacleParent) {
            this._pool = new ObjectPool(this.obstaclePrefab, this.obstacleParent, GameConfig.poolSize);
        }
        if (this.chargerObstaclePrefab && this.obstacleParent) {
            this._chargerPool = new ObjectPool(
                this.chargerObstaclePrefab,
                this.obstacleParent,
                GameConfig.chargerPoolSize,
            );
        }
        view.on('canvas-resize', this._onCanvasResize, this);
        this._recomputeRecycleThreshold();
    }

    public start(): void {
        this._initDebugGraphics();
    }

    public onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResize, this);
        this._debugGraphics?.node.destroy();
        this._debugGraphics = null;
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

    public setOffscreenRecyclingEnabled(enabled: boolean): void {
        this._offscreenRecycleEnabled = enabled;
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
        const spawnX = this._computeSpawnLocalX(GameConfig.finishSpawnViewportMargin);
        n.setPosition(spawnX, this._getObstacleSpawnBaseY(), 0);
        let obs = n.getComponent(Obstacle);
        if (!obs) {
            obs = n.addComponent(Obstacle);
        }
        obs.moveSpeed = this._runSpeed;
        obs.speedScale = 1;
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
        this._updateDebugDraw();
        if (!this._spawningObstacles || !this._pool) {
            return;
        }
        this._spawnTimer += dt;
        if (this._spawnTimer >= this._nextSpawnAt) {
            this._spawnTimer = 0;
            const spawnedCharger = this._spawnOneObstacle();
            this._scheduleNextSpawn(spawnedCharger);
        }
    }

    public recycleAllObstacles(): void {
        if (!this._pool) {
            return;
        }
        for (const n of [...this._active]) {
            const pool = this._nodeToPool.get(n) ?? this._pool;
            pool.put(n);
        }
        this._active.length = 0;
    }

    private _scheduleNextSpawn(afterChargerSpawn = false): void {
        let next = randomRange(GameConfig.spawnIntervalMin, GameConfig.spawnIntervalMax);
        if (afterChargerSpawn) {
            next += GameConfig.chargerSpawnIntervalExtra;
        }
        this._nextSpawnAt = next;
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
        const scaleX = this.obstacleParent.worldScale.x;
        if (Math.abs(scaleX) <= 1e-5) {
            this._dynamicRecycleX = GameConfig.recycleX;
            return;
        }
        const canvas = this._getCanvas();
        const camera = canvas?.cameraComponent;
        let leftEdgeWorldX: number;
        if (camera) {
            const frame = view.getFrameSize();
            this._screenProbe.set(0, frame.height * 0.5, 0);
            camera.screenToWorld(this._screenProbe, this._worldProbe);
            leftEdgeWorldX = this._worldProbe.x;
        } else {
            leftEdgeWorldX = -GameConfig.designWidth * 0.5;
        }
        const parentWorldX = this.obstacleParent.worldPosition.x;
        const recycleWorldX = leftEdgeWorldX - GameConfig.recycleViewportMargin;
        this._dynamicRecycleX = (recycleWorldX - parentWorldX) / scaleX;
    }

    /** @returns true if a charger was spawned (next interval may be longer). */
    private _spawnOneObstacle(): boolean {
        if (!this._pool || !this.obstacleParent) {
            return false;
        }
        const useCharger =
            this._chargerPool !== null && Math.random() < GameConfig.chargerSpawnChance;
        const pool = useCharger ? this._chargerPool! : this._pool;
        const jitter =
            GameConfig.obstacleYJitter > 0
                ? randomRange(-GameConfig.obstacleYJitter, GameConfig.obstacleYJitter)
                : 0;
        const y = this._getObstacleSpawnBaseY() + jitter;
        const node = pool.get();
        this._nodeToPool.set(node, pool);
        const spawnX = this._computeSpawnLocalX(GameConfig.spawnEdgeOffset);
        node.setPosition(spawnX, y, 0);
        const o = node.getComponent(Obstacle) ?? node.addComponent(Obstacle);
        o.moveSpeed = this._runSpeed;
        o.speedScale = useCharger ? GameConfig.chargerSpeedScale : 1;
        this._active.push(node);
        return useCharger;
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

    private _computeSpawnLocalX(worldMargin: number): number {
        const parent = this.obstacleParent;
        if (!parent || !parent.isValid) {
            return GameConfig.designWidth * 0.5 + worldMargin;
        }
        const rightWorldX = this._computeRightViewportWorldX();
        return this._worldXToParentLocalX(rightWorldX + worldMargin, parent);
    }

    private _computeRightViewportWorldX(): number {
        const canvas = this._getCanvas();
        const camera = canvas?.cameraComponent;
        if (camera) {
            const frame = view.getFrameSize();
            this._screenProbe.set(frame.width, frame.height * 0.5, 0);
            camera.screenToWorld(this._screenProbe, this._worldProbe);
            return this._worldProbe.x;
        }
        return GameConfig.designWidth * 0.5;
    }

    private _worldXToParentLocalX(worldX: number, parent: Node): number {
        const scaleX = parent.worldScale.x;
        if (Math.abs(scaleX) <= 1e-5) {
            return worldX;
        }
        return (worldX - parent.worldPosition.x) / scaleX;
    }

    private _initDebugGraphics(): void {
        if (!this.debugDrawSpawnEdge) {
            return;
        }
        const canvas = this._getCanvas();
        if (!canvas) {
            return;
        }
        const debugNode = new Node('__SpawnerDebug__');
        debugNode.setParent(canvas.node);
        debugNode.setPosition(0, 0, 0);
        this._debugGraphics = debugNode.addComponent(Graphics);
    }

    private _updateDebugDraw(): void {
        const g = this._debugGraphics;
        if (!g?.isValid || !this.debugDrawSpawnEdge) {
            return;
        }
        const canvas = this._getCanvas();
        if (!canvas) {
            return;
        }
        const rightWorldX = this._computeRightViewportWorldX();
        const spawnWorldX = rightWorldX + GameConfig.spawnEdgeOffset;

        this._debugLocalProbe.set(rightWorldX, 0, 0);
        canvas.node.inverseTransformPoint(this._debugLocalProbe, this._debugLocalProbe);
        const edgeLocalX = this._debugLocalProbe.x;

        this._debugLocalProbe.set(spawnWorldX, 0, 0);
        canvas.node.inverseTransformPoint(this._debugLocalProbe, this._debugLocalProbe);
        const spawnLocalX = this._debugLocalProbe.x;

        g.clear();

        // Green circle = raw right viewport edge
        g.fillColor = new Color(0, 230, 80, 200);
        g.circle(edgeLocalX, 0, 18);
        g.fill();

        // Red circle = spawn point (edge + offset)
        g.fillColor = new Color(255, 50, 50, 220);
        g.circle(spawnLocalX, 0, 30);
        g.fill();
    }

    private _getCanvas(): Canvas | null {
        if (this._canvas && this._canvas.isValid) {
            return this._canvas;
        }
        const nextCanvas = this.node.scene?.getComponentInChildren(Canvas) ?? null;
        this._canvas = nextCanvas && nextCanvas.isValid ? nextCanvas : null;
        return this._canvas;
    }

    private _recycleOffscreen(): void {
        if (!this._offscreenRecycleEnabled || !this._pool) {
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
                const pool = this._nodeToPool.get(n) ?? this._pool;
                pool.put(n);
                this._active.splice(i, 1);
            }
        }
    }
}
