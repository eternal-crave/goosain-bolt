/**
 * Narrow surface so finish UI does not create circular imports with GameFlow.
 */
export interface IRunnerState {
    notifyWin(): void;
}
