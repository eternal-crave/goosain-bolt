/**
 * Central tunables for side-scroller runner. Adjust without touching gameplay logic.
 */
export const GameConfig = {
  designWidth: 1080,
  designHeight: 1920,

  /** Player anchor X (fixed while side-scrolling, local under GameRoot). */
  playerX: -320,

  /** Ground line local Y under GameRoot (synced to initial Player Y in Main.scene). */
  groundY: -336.8345,

  /** Upward velocity applied on jump (local units / s). */
  jumpVelocity: 780,

  /** Gravity pulling player down (local units / s²). */
  gravity: 2200,

  /** Horizontal scroll speed: hazards move left this many units per second. */
  baseRunSpeed: 380,

  /** Speed added over time until max. */
  speedRampPerSecond: 10,
  maxRunSpeed: 720,

  /** Distance (abstract) before finish sequence starts. */
  distanceToFinish: 4200,

  /** Seconds without new obstacles after finish spawns. */
  obstacleGraceAfterFinish: 2.4,

  /** Spawner timing. */
  spawnIntervalMin: 2.5,
  spawnIntervalMax: 3,

  /** Spawn hazards off-screen to the right (local X under obstacle parent). */
  spawnX: 640,

  /** Recycle when hazard local X is left of this. */
  recycleX: -720,

  /** Extra world-space distance beyond left viewport edge before recycling obstacles. */
  recycleViewportMargin: 120,

  /** Hazard anchor Y aligned with groundY so floor obstacles share the same baseline. */
  obstacleY: -336.8345,

  /** Optional vertical jitter for hazards (±pixels). */
  obstacleYJitter: 0,

  /** Pool capacity for obstacles. */
  poolSize: 16,

  /** Closing hazard: effective speed = runSpeed × this (must be > 1 vs world scroll). */
  chargerSpeedScale: 1.35,

  /** Probability to spawn from charger prefab pool when that prefab is assigned on Spawner. */
  chargerSpawnChance: 0.75,

  /** Extra seconds added to the *next* spawn delay after a charger spawned (breathing room). */
  chargerSpawnIntervalExtra: 0.55,

  /** Pool capacity for charger prefab instances. */
  chargerPoolSize: 8,

  /** One background tile width in local space (match UITransform width of each BgTile). */
  bgTileWidth: 1080,

  /** Legacy FinishRibbon simulation (unused by side-scroller flow). */
  ribbonSegments: 22,
  ribbonIterations: 6,
  ribbonGravity: 980,
  ribbonDamping: 0.02,
} as const;
