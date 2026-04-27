import { _decorator, Component, EventTouch, input, Input, Label, Node } from 'cc';
import { GameConfig } from '../config/GameConfig';
import { FinishRibbon } from '../finish/FinishRibbon';
import { PlayerController } from '../player/PlayerController';
import type { IRunnerState } from './IRunnerState';
import { Spawner } from './Spawner';
import { WorldScroll } from './WorldScroll';

const { ccclass, property } = _decorator;

enum RunState {
    Menu = 0,
    Running = 1,
    Won = 2,
    Lost = 3,
}

@ccclass('GameFlow')
export class GameFlow extends Component implements IRunnerState {
    @property(PlayerController)
    public player: PlayerController | null = null;

    @property(Spawner)
    public spawner: Spawner | null = null;

    @property(WorldScroll)
    public worldScroll: WorldScroll | null = null;

    @property(Node)
    public tapToStart: Node | null = null;

    @property(Label)
    public labelWin: Label | null = null;

    @property(Label)
    public labelGameOver: Label | null = null;

    private _state = RunState.Menu;
    private _distance = 0;
    private _runSpeed = 0;
    private _finishScheduled = false;
    private _graceTimer = 0;
    private _finishWired = false;

    public onLoad(): void {
        input.on(Input.EventType.TOUCH_END, this._onTapMenu, this);
        this._setHudMenu();
    }

    public onDestroy(): void {
        input.off(Input.EventType.TOUCH_END, this._onTapMenu, this);
    }

    public notifyWin(): void {
        if (this._state !== RunState.Running) {
            return;
        }
        this._state = RunState.Won;
        this._applyRunningAudioVisual(false);
        if (this.labelWin) {
            this.labelWin.node.active = true;
        }
        if (this.labelGameOver) {
            this.labelGameOver.node.active = false;
        }
        this.scheduleOnce(() => this._restartToMenu(), 1.8);
    }

    public update(dt: number): void {
        if (this._state !== RunState.Running) {
            return;
        }
        this._runSpeed = Math.min(
            GameConfig.maxRunSpeed,
            GameConfig.baseRunSpeed + this._distance * 0.001 + GameConfig.speedRampPerSecond * (this._distance / 2000),
        );
        this.spawner?.setRunSpeed(this._runSpeed);
        this.worldScroll?.setScrollSpeed(this._runSpeed);
        this._distance += this._runSpeed * dt;

        if (!this._finishScheduled && this._distance >= GameConfig.distanceToFinish) {
            this._finishScheduled = true;
            this.spawner?.spawnFinishLine();
            this._graceTimer = GameConfig.obstacleGraceAfterFinish;
            this._finishWired = false;
        }

        if (this._finishScheduled && this._graceTimer > 0) {
            this._graceTimer -= dt;
            if (this._graceTimer <= 0) {
                this.spawner?.setObstacleSpawning(false);
            }
        }

        this._ensureFinishRibbonWired();

        const ribbon = this._findFinishRibbon();
        if (ribbon) {
            ribbon.setRunSpeed(this._runSpeed);
        }

        if (this.player && this.spawner) {
            if (this.player.hitsAnyObstacle(this.spawner.getActiveObstacles())) {
                this._lose();
            }
        }
    }

    private _onTapMenu(_e: EventTouch): void {
        if (this._state !== RunState.Menu) {
            return;
        }
        this._beginRun();
    }

    private _beginRun(): void {
        this._state = RunState.Running;
        this._distance = 0;
        this._runSpeed = GameConfig.baseRunSpeed;
        this._finishScheduled = false;
        this._graceTimer = 0;
        this._finishWired = false;
        this.player?.resetToCenterLane();
        this.spawner?.resetForNewRun();
        this.spawner?.setObstacleSpawning(true);
        this.spawner?.setRunSpeed(this._runSpeed);
        this.worldScroll?.setScrollSpeed(this._runSpeed);
        this._setHudRunning();
    }

    private _lose(): void {
        if (this._state !== RunState.Running) {
            return;
        }
        this._state = RunState.Lost;
        this._applyRunningAudioVisual(false);
        if (this.labelGameOver) {
            this.labelGameOver.node.active = true;
        }
        if (this.labelWin) {
            this.labelWin.node.active = false;
        }
        this.scheduleOnce(() => this._restartToMenu(), 1.4);
    }

    private _restartToMenu(): void {
        this._state = RunState.Menu;
        this._distance = 0;
        this._finishScheduled = false;
        this._finishWired = false;
        this.spawner?.setObstacleSpawning(false);
        this.spawner?.resetForNewRun();
        this._setHudMenu();
    }

    private _setHudMenu(): void {
        if (this.tapToStart) {
            this.tapToStart.active = true;
        }
        if (this.labelWin) {
            this.labelWin.node.active = false;
        }
        if (this.labelGameOver) {
            this.labelGameOver.node.active = false;
        }
    }

    private _setHudRunning(): void {
        if (this.tapToStart) {
            this.tapToStart.active = false;
        }
        if (this.labelWin) {
            this.labelWin.node.active = false;
        }
        if (this.labelGameOver) {
            this.labelGameOver.node.active = false;
        }
    }

    private _applyRunningAudioVisual(running: boolean): void {
        void running;
    }

    private _findFinishRibbon(): FinishRibbon | null {
        const n = this.spawner?.getFinishNode();
        if (!n || !n.isValid) {
            return null;
        }
        return n.getComponent(FinishRibbon) ?? n.getComponentInChildren(FinishRibbon);
    }

    private _ensureFinishRibbonWired(): void {
        if (this._finishWired) {
            return;
        }
        const ribbon = this._findFinishRibbon();
        if (!ribbon) {
            return;
        }
        ribbon.flowTarget = this;
        if (this.player) {
            ribbon.playerNode = this.player.node;
        }
        this._finishWired = true;
    }
}
