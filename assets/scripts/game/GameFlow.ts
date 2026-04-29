import { _decorator, CCFloat, Component, EventTouch, input, Input, Label, Node } from 'cc';
import { GameConfig } from '../config/GameConfig';
import { CurrencySpawner } from '../currency/CurrencySpawner';
import { CurrencyWallet } from '../currency/CurrencyWallet';
import { PlayerController } from '../player/PlayerController';
import { PlayerVisualAnimator } from '../player/PlayerVisualAnimator';
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
export class GameFlow extends Component {
    @property(PlayerController)
    public player: PlayerController | null = null;

    @property(Spawner)
    public spawner: Spawner | null = null;

    @property(WorldScroll)
    public worldScroll: WorldScroll | null = null;

    @property(CurrencySpawner)
    public currencySpawner: CurrencySpawner | null = null;

    @property(CurrencyWallet)
    public currencyWallet: CurrencyWallet | null = null;

    @property(Node)
    public tapToStart: Node | null = null;

    @property(Label)
    public labelWin: Label | null = null;

    @property(Label)
    public labelGameOver: Label | null = null;

    @property({ type: CCFloat, tooltip: 'Starting horizontal speed for each run.' })
    public baseRunSpeed = GameConfig.baseRunSpeed;

    @property({ type: CCFloat, tooltip: 'Additional speed gain over distance.' })
    public speedRampPerSecond = GameConfig.speedRampPerSecond;

    @property({ type: CCFloat, tooltip: 'Maximum horizontal speed cap.' })
    public maxRunSpeed = GameConfig.maxRunSpeed;

    @property({ type: CCFloat, tooltip: 'Linear distance factor added to run speed.' })
    public distanceLinearFactor = 0.001;

    @property({ type: CCFloat, tooltip: 'Distance divisor used by speed ramp term.' })
    public distanceRampDivisor = 2000;

    private _state = RunState.Menu;
    private _distance = 0;
    private _runSpeed = 0;
    private _finishScheduled = false;
    private _graceTimer = 0;

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
        this.currencySpawner?.setMoneySpawning(false);
        this._applyRunningAudioVisual(false);
        if (this.labelWin) {
            this.labelWin.node.active = true;
        }
        if (this.labelGameOver) {
            this.labelGameOver.node.active = false;
        }
        if (this.player) {
            this.player.inputEnabled = false;
            this.player.stopPresentation();
        }
        this.scheduleOnce(() => this._restartToMenu(), 1.8);
    }

    public update(dt: number): void {
        if (this._state !== RunState.Running) {
            return;
        }
        this._runSpeed = this._calculateRunSpeed(this._distance);
        this.spawner?.setRunSpeed(this._runSpeed);
        this.currencySpawner?.setRunSpeed(this._runSpeed);
        this.worldScroll?.setScrollSpeed(this._runSpeed);
        this._distance += this._runSpeed * dt;

        if (!this._finishScheduled && this._distance >= GameConfig.distanceToFinish) {
            this._finishScheduled = true;
            this.spawner?.spawnFinishLine();
            this._graceTimer = GameConfig.obstacleGraceAfterFinish;
        }

        if (this._finishScheduled && this._graceTimer > 0) {
            this._graceTimer -= dt;
            if (this._graceTimer <= 0) {
                this.spawner?.setObstacleSpawning(false);
            }
        }

        if (this.player && this.spawner) {
            if (this.player.hitsAnyObstacle(this.spawner.getActiveObstacles())) {
                this._lose();
                return;
            }
            const finish = this.spawner.getFinishNode();
            if (finish && this.player.overlapsFinish(finish)) {
                this.notifyWin();
            }
            if (this._state === RunState.Running) {
                this.currencySpawner?.processCollection(this.player, this.currencyWallet);
            }
        }
    }

    private _onTapMenu(_e: EventTouch): void {
        if (this._state !== RunState.Menu) {
            return;
        }
        this._beginRun();
    }

    private _calculateRunSpeed(distance: number): number {
        const safeRampDivisor = this.distanceRampDivisor <= 0 ? 1 : this.distanceRampDivisor;
        const nextSpeed =
            this.baseRunSpeed +
            distance * this.distanceLinearFactor +
            this.speedRampPerSecond * (distance / safeRampDivisor);
        return Math.min(this.maxRunSpeed, nextSpeed);
    }

    private _beginRun(): void {
        this._state = RunState.Running;
        this._distance = 0;
        this._runSpeed = this._calculateRunSpeed(0);
        this._finishScheduled = false;
        this._graceTimer = 0;
        this.player?.resetForRun();
        this.spawner?.resetForNewRun();
        this.spawner?.setObstacleSpawning(true);
        this.spawner?.setRunSpeed(this._runSpeed);
        this.currencyWallet?.reset();
        this.currencySpawner?.resetForNewRun();
        this.currencySpawner?.setMoneySpawning(true);
        this.currencySpawner?.setRunSpeed(this._runSpeed);
        this.worldScroll?.setScrollSpeed(this._runSpeed);
        if (this.player) {
            this.player.inputEnabled = true;
            this.player.node.getComponent(PlayerVisualAnimator)?.enterRunning();
        }
        this._setHudRunning();
    }

    private _lose(): void {
        if (this._state !== RunState.Running) {
            return;
        }
        this._state = RunState.Lost;
        this.currencySpawner?.setMoneySpawning(false);
        this._applyRunningAudioVisual(false);
        if (this.player) {
            this.player.inputEnabled = false;
            this.player.stopPresentation();
        }
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
        this.spawner?.setObstacleSpawning(false);
        this.spawner?.resetForNewRun();
        this.currencySpawner?.setMoneySpawning(false);
        this.currencySpawner?.resetForNewRun();
        this.currencyWallet?.reset();
        if (this.player) {
            this.player.inputEnabled = false;
            this.player.resetForRun();
        }
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
}
