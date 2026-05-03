import {
    _decorator,
    CCBoolean,
    Canvas,
    Color,
    Component,
    Graphics,
    Node,
    UITransform,
    Vec3,
    view,
} from 'cc';
import { GameConfig } from '../config/GameConfig';
import { ViewportLeftRightWorld, getViewportLeftRightWorld } from './viewportEdgeWorld';

const { ccclass, property, executionOrder } = _decorator;

const DEBUG_FILL_COLOR = new Color(255, 32, 32, 255);
const DEBUG_RADIUS = 28;

/** Refreshes viewport left/right world X before gameplay spawners; subscribes to canvas resize. */
@ccclass('ScreenEdgeProvider')
@executionOrder(-100)
export class ScreenEdgeProvider extends Component {
    @property({
        type: Canvas,
        tooltip: 'Optional. If empty, first Canvas in the scene is used.',
    })
    public canvasHint: Canvas | null = null;

    @property({
        type: CCBoolean,
        displayName: 'Debug Draw Viewport Edges',
        tooltip:
            'Draw circles at viewport left, recycle line, right, and spawn line (spawn edge margin).',
    })
    public debugDrawViewportEdges = false;

    private _canvas: Canvas | null = null;
    private readonly _screenProbe = new Vec3();
    private readonly _worldProbe = new Vec3();
    private _cached: ViewportLeftRightWorld = ScreenEdgeProvider._defaultViewport();
    private _debugGraphics: Graphics | null = null;
    private _debugGraphicsUi: UITransform | null = null;
    private readonly _debugLocal = new Vec3();

    public onLoad(): void {
        view.on('canvas-resize', this._onCanvasResize, this);
        this.refresh();
    }

    public onDestroy(): void {
        view.off('canvas-resize', this._onCanvasResize, this);
    }

    public update(): void {
        this.refresh();
    }

    public lateUpdate(): void {
        const showDebug = this.debugDrawViewportEdges || GameConfig.showViewportEdgeDebug;
        if (!showDebug) {
            this._debugGraphics?.clear();
            return;
        }
        this._ensureViewportDebugOverlay();
        const g = this._debugGraphics;
        const ui = this._debugGraphicsUi;
        if (!g || !ui || !g.isValid || !ui.isValid) {
            return;
        }
        this._drawViewportEdgeDebugCircles(g, ui);
    }

    /** Latest snapshot from the canvas camera via screenToWorld (updated each frame and on resize). */
    public getViewportEdges(): ViewportLeftRightWorld {
        return this._cached;
    }

    public refresh(): void {
        const vp = getViewportLeftRightWorld(this.getCanvas(), this._screenProbe, this._worldProbe);
        this._cached = vp;
    }

    /** World-space X beyond the viewport right edge, using current cache plus margin. */
    public getSpawnWorldX(margin: number): number {
        return this._cached.right + margin;
    }

    /**
     * Converts a world-space X coordinate into the parent's local space (same formula as obstacle/money spawn).
     */
    public worldXToParentLocalX(worldX: number, parent: Node): number {
        const scaleX = parent.worldScale.x;
        if (Math.abs(scaleX) <= 1e-5) {
            return worldX;
        }
        return (worldX - parent.worldPosition.x) / scaleX;
    }

    public getCanvas(): Canvas | null {
        if (this.canvasHint?.isValid) {
            return this.canvasHint;
        }
        if (this._canvas && this._canvas.isValid) {
            return this._canvas;
        }
        const nextCanvas = this.node.scene?.getComponentInChildren(Canvas) ?? null;
        this._canvas = nextCanvas && nextCanvas.isValid ? nextCanvas : null;
        return this._canvas;
    }

    private static _defaultViewport(): ViewportLeftRightWorld {
        const half = GameConfig.designWidth * 0.5;
        return { left: -half, right: half, midWorldY: 0, midWorldZ: 0 };
    }

    /** Uses `_cached` (same edges as gameplay) plus recycle/spawn margins from GameConfig. */
    private _drawViewportEdgeDebugCircles(graphics: Graphics, uiTransform: UITransform): void {
        graphics.clear();
        const { left, right, midWorldY, midWorldZ } = this._cached;
        const recycleX = left - GameConfig.recycleViewportMargin;
        const spawnLineX = right + GameConfig.spawnEdgeOffset;
        const worldScratch = this._worldProbe;
        const fillDisc = (worldX: number): void => {
            worldScratch.set(worldX, midWorldY, midWorldZ);
            uiTransform.convertToNodeSpaceAR(worldScratch, this._debugLocal);
            graphics.fillColor = DEBUG_FILL_COLOR;
            graphics.circle(this._debugLocal.x, this._debugLocal.y, DEBUG_RADIUS);
            graphics.fill();
        };
        fillDisc(left);
        fillDisc(recycleX);
        fillDisc(right);
        fillDisc(spawnLineX);
    }

    private _onCanvasResize(): void {
        this.refresh();
        this._resizeDebugOverlayToVisible();
    }

    private _resizeDebugOverlayToVisible(): void {
        const ui = this._debugGraphicsUi;
        if (!ui?.isValid) {
            return;
        }
        const vs = view.getVisibleSize();
        ui.setContentSize(vs.width, vs.height);
    }

    private _ensureViewportDebugOverlay(): void {
        if (this._debugGraphics?.isValid && this._debugGraphicsUi?.isValid) {
            return;
        }
        const canvas = this.getCanvas();
        const parentNode = canvas?.node ?? this.node;
        const n = new Node('ViewportEdgeDebug');
        n.layer = parentNode.layer;
        n.setParent(parentNode);
        const ui = n.addComponent(UITransform);
        const vs = view.getVisibleSize();
        ui.setContentSize(vs.width, vs.height);
        const g = n.addComponent(Graphics);
        this._debugGraphics = g;
        this._debugGraphicsUi = ui;
        n.setSiblingIndex(Math.max(0, parentNode.children.length - 1));
    }
}
