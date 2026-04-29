export enum MoneyLayoutStrategy {
    Flat = 0,
    Chevron = 1,
    ZigZag = 2,
}

/**
 * Shape-only Y factors (chevron peak 1, zigzag ±1, flat 0). Multiply by a scale in the spawner.
 */
export function computeNormalizedLayoutYs(
    strategy: MoneyLayoutStrategy,
    count: number,
): number[] {
    return computeLayoutYs(strategy, count, 1);
}

/**
 * Returns per-bill Y offsets from cluster baseline (local space).
 */
export function computeLayoutYs(
    strategy: MoneyLayoutStrategy,
    count: number,
    amplitude: number,
): number[] {
    const safeCount = Math.max(1, Math.floor(count));
    const amp = Number.isFinite(amplitude) ? amplitude : 0;
    const ys: number[] = [];
    for (let i = 0; i < safeCount; i++) {
        ys.push(_offsetForIndex(strategy, i, safeCount, amp));
    }
    return ys;
}

function _offsetForIndex(
    strategy: MoneyLayoutStrategy,
    index: number,
    count: number,
    amplitude: number,
): number {
    switch (strategy) {
        case MoneyLayoutStrategy.Flat:
            return 0;
        case MoneyLayoutStrategy.Chevron: {
            if (count <= 1) {
                return 0;
            }
            const t = index / (count - 1);
            return amplitude * Math.sin(Math.PI * t);
        }
        case MoneyLayoutStrategy.ZigZag:
            return amplitude * (index % 2 === 0 ? 1 : -1);
        default:
            return 0;
    }
}

export function pickRandomLayoutStrategy(): MoneyLayoutStrategy {
    const values = [
        MoneyLayoutStrategy.Flat,
        MoneyLayoutStrategy.Chevron,
        MoneyLayoutStrategy.ZigZag,
    ];
    return values[Math.floor(Math.random() * values.length)]!;
}
