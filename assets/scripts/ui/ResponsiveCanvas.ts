import { _decorator, Canvas, CCFloat, Component, Node, UITransform, view, View } from 'cc';

const { ccclass, property } = _decorator;

/**
 * Keeps a design-sized layout root scaled on very wide or tall viewports.
 * Primary fit policy should still be set on the Canvas in the editor.
 */
@ccclass('ResponsiveCanvas')
export class ResponsiveCanvas extends Component {
    @property(Canvas)
    public canvas: Canvas | null = null;

    @property(Node)
    public layoutRoot: Node | null = null;

    @property({ type: CCFloat, tooltip: 'Design width matching Canvas design resolution' })
    public designWidth = 1080;

    @property({ type: CCFloat, tooltip: 'Design height matching Canvas design resolution' })
    public designHeight = 1920;

    @property({ type: CCFloat, tooltip: 'Clamp scale so UI never shrinks below this factor' })
    public minScale = 0.82;

    @property({ type: CCFloat, tooltip: 'Clamp scale so UI never grows above this factor' })
    public maxScale = 1.12;

    public onLoad(): void {
        if (!this.canvas) {
            this.canvas = this.getComponent(Canvas);
        }
        view.on('canvas-resize', this._onResize, this);
        this._onResize();
    }

    public onDestroy(): void {
        view.off('canvas-resize', this._onResize, this);
    }

    private _onResize(): void {
        const root = this.layoutRoot;
        if (!root) {
            return;
        }
        const vs = View.instance.getVisibleSize();
        if (vs.width <= 0 || vs.height <= 0) {
            return;
        }
        const sx = vs.width / this.designWidth;
        const sy = vs.height / this.designHeight;
        let s = Math.min(sx, sy);
        s = Math.min(this.maxScale, Math.max(this.minScale, s));
        root.setScale(s, s, 1);
        const ui = root.getComponent(UITransform);
        if (ui) {
            ui.setContentSize(this.designWidth, this.designHeight);
        }
    }
}
