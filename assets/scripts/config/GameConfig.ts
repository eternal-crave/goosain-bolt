/**
 * Central tunables for runner feel. Adjust without touching gameplay logic.
 */
export const GameConfig = {
    designWidth: 1080,
    designHeight: 1920,

    /** World Y of player anchor (local under GameRoot). */
    playerY: -720,

    /** Lane centers on X (local space). */
    laneXs: [-220, 0, 220] as const,

    /** Horizontal swipe distance (px) to count as lane change. */
    swipeThreshold: 80,

    /** Run speed in world units per second (obstacles move down). */
    baseRunSpeed: 520,

    /** Speed added over time until max. */
    speedRampPerSecond: 12,
    maxRunSpeed: 920,

    /** Distance (abstract) before finish sequence starts. */
    distanceToFinish: 4200,

    /** Seconds without new obstacles after finish spawns. */
    obstacleGraceAfterFinish: 2.4,

    /** Spawner timing. */
    spawnIntervalMin: 0.55,
    spawnIntervalMax: 1.15,

    /** Spawn center Y above player (local). */
    spawnY: 900,

    /** Recycle when obstacle local Y below this. */
    recycleY: -980,

    /** Pool capacity for obstacles. */
    poolSize: 16,

    /** Finish ribbon simulation. */
    ribbonSegments: 22,
    ribbonIterations: 6,
    ribbonGravity: 980,
    ribbonDamping: 0.02,
} as const;

export type LaneIndex = 0 | 1 | 2;
