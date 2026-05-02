import { _decorator, CCFloat, Component, EventTouch, find, input, Input, Label, Node } from 'cc';
import { GameSfx } from '../audio/GameSfx';
import { GameConfig } from '../config/GameConfig';
import { CurrencySpawner } from '../currency/CurrencySpawner';
import { CurrencyWallet } from '../currency/CurrencyWallet';
import { PlayerController } from '../player/PlayerController';
import { PlayerHealth } from '../player/PlayerHealth';
import { PlayerVisualAnimator } from '../player/PlayerVisualAnimator';
import { LoseUi } from '../ui/LoseUi';
import { FinishRope } from '../finish/FinishRope';
import { Spawner } from './Spawner';
import { WorldScroll } from './WorldScroll';
import { ConfettyFXManager } from '../fx/ConfettyFXManager';

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

    @property({
        type: PlayerHealth,
        tooltip:
            'Run HP (3 by default). If empty, first obstacle overlap still ends the run instantly. Wire HealthHud to the same component.',
    })
    public playerHealth: PlayerHealth | null = null;

    @property(Node)
    public tapToStart: Node | null = null;

    @property(Label)
    public labelWin: Label | null = null;

    @property(LoseUi)
    public loseUi: LoseUi | null = null;

    @property({
        type: GameSfx,
        tooltip: 'SFX + optional looping run BGM (assign clips on GameSfx).',
    })
    public sfx: GameSfx | null = null;

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
    /** After a loss or win, keep GameEndPanel visible until the player taps to return to menu / start again. */
    private _gameEndPanelPinned = false;
    /** Obstacle roots that already dealt damage for the current continuous overlap. */
    private readonly _obstacleDamageClaimed = new Set<Node>();

    private readonly _onPlayerDamaged = (): void => {
        this.sfx?.playDamage();
    };

    public onLoad(): void {
        input.on(Input.EventType.TOUCH_END, this._onTapMenu, this);
        this._ensureLoseUi();
        this._setHudMenu();
        this.spawner?.setOffscreenRecyclingEnabled(true);
        this.currencySpawner?.setOffscreenRecyclingEnabled(true);
        this._stopRunMotion();
    }

    public onEnable(): void {
        this.playerHealth?.onDamaged(this._onPlayerDamaged, this);
    }

    public onDisable(): void {
        this.playerHealth?.offDamaged(this._onPlayerDamaged, this);
    }

    public onDestroy(): void {
        input.off(Input.EventType.TOUCH_END, this._onTapMenu, this);
    }

    public notifyWin(): void {
        if (this._state !== RunState.Running) {
            return;
        }
        this.sfx?.playFinish();
        this._state = RunState.Won;
        const introDelay = (this.loseUi?.introDurationUp ?? 0.35) + (this.loseUi?.introDurationSettle ?? 0.22);
        this.scheduleOnce(() => {
            if (this._state === RunState.Won) {
                ConfettyFXManager.instance?.play();
            }
        }, introDelay);
        this._gameEndPanelPinned = true;
        this.spawner?.setObstacleSpawning(false);
        this.spawner?.setOffscreenRecyclingEnabled(false);
        this.currencySpawner?.setOffscreenRecyclingEnabled(false);
        this._stopRunMotion();
        this.currencySpawner?.setMoneySpawning(false);
        this._applyRunningAudioVisual(false);
        if (this.labelWin) {
            this.labelWin.node.active = false;
        }
        this._ensureLoseUi();
        if (this.loseUi) {
            this.loseUi.applyRunEnd(true);
            this.loseUi.node.active = true;
        }
        if (this.player) {
            this.player.inputEnabled = false;
            this.player.stopPresentation();
        }
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

        const finishSpawnAt = GameConfig.distanceToFinish - GameConfig.finishSpawnLead;
        if (!this._finishScheduled && this._distance >= finishSpawnAt) {
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
            const activeObstacles = this.spawner.getActiveObstacles();
            if (this.playerHealth) {
                const overlapping = this.player.getOverlappingObstacleRoots(activeObstacles);
                const overlappingSet = new Set(overlapping);
                for (const n of this._obstacleDamageClaimed) {
                    if (!overlappingSet.has(n) || !n.isValid) {
                        this._obstacleDamageClaimed.delete(n);
                    }
                }
                for (const n of overlapping) {
                    if (!this._obstacleDamageClaimed.has(n)) {
                        this._obstacleDamageClaimed.add(n);
                        if (this.playerHealth.applyDamage(1)) {
                            this._lose();
                            return;
                        }
                    }
                }
            } else if (this.player.hitsAnyObstacle(activeObstacles)) {
                this._lose();
                return;
            }
            const finish = this.spawner.getFinishNode();
            if (finish && this.player.overlapsFinish(finish)) {
                finish.getComponent(FinishRope)?.playSplit();
                this.notifyWin();
            }
            if (this._state === RunState.Running) {
                this.currencySpawner?.processCollection(this.player, this.currencyWallet);
            }
        }
    }

    private _ensureLoseUi(): void {
        const panel = find('Canvas/HUD/GameEndPanel');
        if (!panel) {
            return;
        }
        let ui = this.loseUi;
        if (!ui?.isValid) {
            ui = panel.getComponent(LoseUi) ?? panel.addComponent(LoseUi);
            this.loseUi = ui;
        }
        ui.wallet = this.currencyWallet ?? null;
        ui.labelTitle = panel.getChildByName('LoseTitle')?.getComponent(Label) ?? ui.labelTitle;
        ui.labelSubtitle = panel.getChildByName('LoseSubtitle')?.getComponent(Label) ?? ui.labelSubtitle;
        ui.labelCardAmount = panel.getChildByName('LoseCardAmount')?.getComponent(Label) ?? ui.labelCardAmount;
        ui.ctaNode = panel.getChildByName('InstallCta') ?? ui.ctaNode;
        if (!ui.introRevealTarget) {
            ui.introRevealTarget = panel.getChildByName('LoseIntroRoot') ?? null;
        }
    }

    private _onTapMenu(_e: EventTouch): void {
        if (this._state === RunState.Lost || this._state === RunState.Won) {
            this._restartToMenu();
            return;
        }
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
        this._gameEndPanelPinned = false;
        this._state = RunState.Running;
        this.spawner?.setOffscreenRecyclingEnabled(true);
        this.currencySpawner?.setOffscreenRecyclingEnabled(true);
        this._distance = 0;
        this._runSpeed = this._calculateRunSpeed(0);
        this._finishScheduled = false;
        this._graceTimer = 0;
        this._obstacleDamageClaimed.clear();
        this.playerHealth?.reset();
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
        this._applyRunningAudioVisual(true);
    }

    private _lose(): void {
        if (this._state !== RunState.Running) {
            return;
        }
        this.sfx?.playLose();
        this._state = RunState.Lost;
        this._gameEndPanelPinned = true;

        this._ensureLoseUi();
        if (this.loseUi) {
            this.loseUi.applyRunEnd(false);
            this.loseUi.node.active = true;
        }
        if (this.labelWin) {
            this.labelWin.node.active = false;
        }

        this.spawner?.setObstacleSpawning(false);
        this.spawner?.setOffscreenRecyclingEnabled(false);
        this.currencySpawner?.setOffscreenRecyclingEnabled(false);
        this._stopRunMotion();

        this.currencySpawner?.setMoneySpawning(false);
        this._applyRunningAudioVisual(false);
        if (this.player) {
            this.player.inputEnabled = false;
            this.player.stopPresentation();
        }
    }

    private _restartToMenu(): void {
        this._state = RunState.Menu;
        this.spawner?.setOffscreenRecyclingEnabled(true);
        this.currencySpawner?.setOffscreenRecyclingEnabled(true);
        this._stopRunMotion();
        this._distance = 0;
        this._finishScheduled = false;
        this.spawner?.setObstacleSpawning(false);
        this.spawner?.resetForNewRun();
        this.currencySpawner?.setMoneySpawning(false);
        this.currencySpawner?.resetForNewRun();
        this.currencyWallet?.reset();
        this._obstacleDamageClaimed.clear();
        this.playerHealth?.reset();
        if (this.player) {
            this.player.inputEnabled = false;
            this.player.resetForRun();
        }
        this._applyRunningAudioVisual(false);
        this._setHudMenu();
    }

    private _setHudMenu(): void {
        if (this.tapToStart) {
            this.tapToStart.active = true;
        }
        if (this.labelWin) {
            this.labelWin.node.active = false;
        }
        if (this.loseUi && !this._gameEndPanelPinned) {
            this.loseUi.node.active = false;
        }
    }

    private _setHudRunning(): void {
        if (this.tapToStart) {
            this.tapToStart.active = false;
        }
        if (this.labelWin) {
            this.labelWin.node.active = false;
        }
        if (this.loseUi) {
            this.loseUi.node.active = false;
        }
    }

    private _applyRunningAudioVisual(running: boolean): void {
        this.sfx?.setRunBgmActive(running);
    }

    private _stopRunMotion(): void {
        this.worldScroll?.setScrollSpeed(0);
        this.spawner?.setRunSpeed(0);
        this.currencySpawner?.setRunSpeed(0);
    }
}
