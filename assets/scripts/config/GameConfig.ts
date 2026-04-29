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

  /** Lives at run start; obstacle damage subtracts until game over at 0. */
  startingHealth: 3,

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
  distanceToFinish: 8000,

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

  /** Seconds between money cluster spawns (random in range). */
  moneySpawnIntervalMin: 1.8,
  moneySpawnIntervalMax: 2.8,

  /** Bills per cluster (inclusive). */
  moneyBillsMin: 2,
  moneyBillsMax: 4,

  /** Minimum center-to-center X between bills; size-based spacing can exceed this. */
  moneyStepX: 144,

  /** Vertical layout amplitude for chevron / zigzag (local Y). */
  moneyLayoutAmplitude: 200,

  /** Local Y of cluster baseline above money parent origin (same space as obstacles if parent shared). */
  moneyBaselineLocalY: 140,

  /** Prewarmed instances per money prefab variant. */
  moneyPoolSizePerPrefab: 8,
} as const;
