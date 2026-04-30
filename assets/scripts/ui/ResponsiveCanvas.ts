import {
    _decorator,
    Camera,
    CCFloat,
    Component,
    ResolutionPolicy,
    Size,
    view,
} from 'cc';

const { ccclass, property } = _decorator;

/**
 * Attaches to the Canvas node and enforces full-screen viewport adaptation
 * at startup and whenever the browser window / device orientation changes.
 *
 * Responsibilities:
 *  - Calls view.resizeWithBrowserSize(true) so the HTML canvas element always
 *    tracks the browser window size.
 *  - Calls view.setResolutionPolicy(ResolutionPolicy.NO_BORDER) so the game
 *    always fills the entire viewport with no black bars or grey margins,
 *    cropping a small amount of content on extreme aspect ratios rather than
 *    leaving empty space — the standard approach for playable ads.
 *  - Syncs the orthographic camera's orthoHeight to the current visible height
 *    so world-space units stay consistent after a resize.
 *  - Emits 'viewport-changed' on this node with the current Size so any sibling
 *    or child component can subscribe without coupling to view directly.
 */
@ccclass('ResponsiveCanvas')
export class ResponsiveCanvas extends Component {
    @property({ type: Camera, tooltip: 'Scene camera whose orthoHeight will be kept in sync with the visible height.' })
    public cameraComp: Camera | null = null;

    @property({ type: CCFloat, tooltip: 'Design width used as reference for the horizontal axis.' })
    public designWidth = 1080;

    @property({ type: CCFloat, tooltip: 'Design height used as reference for the vertical axis.' })
    public designHeight = 2400;

    // ─── Lifecycle ────────────────────────────────────────────────────────────

    public onLoad(): void {
        this._applyResolutionPolicy();
        view.on('canvas-resize', this._onResize, this);
        this._onResize();
    }

    public onDestroy(): void {
        view.off('canvas-resize', this._onResize, this);
    }

    // ─── Private ──────────────────────────────────────────────────────────────

    private _applyResolutionPolicy(): void {
        view.resizeWithBrowserSize(true);
        view.setResolutionPolicy(ResolutionPolicy.NO_BORDER);
    }

    private _onResize(): void {
        const vs = view.getVisibleSize();
        if (vs.width <= 0 || vs.height <= 0) {
            return;
        }

        this._syncCameraOrthoHeight(vs);
        this.node.emit('viewport-changed', vs);
    }

    private _syncCameraOrthoHeight(vs: Size): void {
        if (!this.cameraComp) {
            return;
        }
        this.cameraComp.orthoHeight = vs.height / 2;
    }
}
