/**
 * Central tunables for side-scroller runner. Adjust without touching gameplay logic.
 */
export const GameConfig = {
    designWidth: 1080,
    designHeight: 1920,

    /** Player anchor X (fixed while side-scrolling, local under GameRoot). */
    playerX: -320,

    /** Ground line local Y under GameRoot (player lands here). */
    groundY: -680,

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
    spawnIntervalMin: 0.85,
    spawnIntervalMax: 1.45,

    /** Spawn hazards off-screen to the right (local X under obstacle parent). */
    spawnX: 640,

    /** Recycle when hazard local X is left of this. */
    recycleX: -720,

    /** Hazard anchor Y (low obstacles on the ground line). */
    obstacleY: -680,

    /** Optional vertical jitter for hazards (±pixels). */
    obstacleYJitter: 90,

    /** Pool capacity for obstacles. */
    poolSize: 16,

    /** One background tile width in local space (match UITransform width of each BgTile). */
    bgTileWidth: 1080,

    /** Legacy FinishRibbon simulation (unused by side-scroller flow). */
    ribbonSegments: 22,
    ribbonIterations: 6,
    ribbonGravity: 980,
    ribbonDamping: 0.02,
} as const;
