import { Canvas, Color, Graphics, UITransform, Vec3, screen, view } from 'cc';
import { GameConfig } from '../config/GameConfig';

export type ViewportLeftRightWorld = {
  left: number;
  right: number;
  midWorldY: number;
  midWorldZ: number;
};

/**
 * Pixel rectangle to feed `Camera.screenToWorld` (window / buffer space, bottom-left origin).
 *
 * Prefer `screen.windowSize` first: on desktop Web, `getVisibleSizeInPixel` + origin can describe a
 * rect that does not match what `screenToWorld` expects, so probes map off-screen and debug draws
 * vanish. On mobile, `windowSize` still matches the adapted game frame per engine docs.
 * Fall back to visible-in-pixel when the window is not ready yet (e.g. first Editor frames).
 */
function getScreenViewportPixels(): { ox: number; oy: number; w: number; h: number } {
  const ws = screen.windowSize;
  if (ws.width > 0 && ws.height > 0) {
    return { ox: 0, oy: 0, w: ws.width, h: ws.height };
  }
  const vp = view.getVisibleSizeInPixel();
  const vo = view.getVisibleOriginInPixel();
  if (vp.width > 0 && vp.height > 0) {
    return { ox: vo.x, oy: vo.y, w: vp.width, h: vp.height };
  }
  return { ox: 0, oy: 0, w: GameConfig.designWidth, h: GameConfig.designHeight };
}

/**
 * Maps the viewport left/right midline screen points to world space (Canvas camera).
 * Reuses `screenProbe` / `worldOut` to avoid per-frame allocations.
 */
export function getViewportLeftRightWorld(
  canvas: Canvas | null,
  screenProbe: Vec3,
  worldOut: Vec3
): ViewportLeftRightWorld {
  const camera = canvas?.cameraComponent;
  if (!camera) {
    return {
      left: -GameConfig.designWidth * 0.5,
      right: GameConfig.designWidth * 0.5,
      midWorldY: 0,
      midWorldZ: 0,
    };
  }
  const { ox, oy, w, h } = getScreenViewportPixels();
  const midY = oy + h * 0.5;
  screenProbe.set(ox, midY, 0);
  camera.screenToWorld(screenProbe, worldOut);
  const left = worldOut.x;
  const midWorldY = worldOut.y;
  const midWorldZ = worldOut.z;
  screenProbe.set(ox + w, midY, 0);
  camera.screenToWorld(screenProbe, worldOut);
  const right = worldOut.x;
  return { left, right, midWorldY, midWorldZ };
}

const DEBUG_FILL_COLOR = new Color(255, 32, 32, 255);
const DEBUG_RADIUS = 28;

/**
 * Filled circles at viewport left, recycle line, viewport right, and spawn line (right + margin).
 */
export function drawViewportEdgeDebugCircles(
  graphics: Graphics,
  uiTransform: UITransform,
  canvas: Canvas | null,
  screenProbe: Vec3,
  worldScratch: Vec3,
  localOut: Vec3,
  spawnWorldMargin: number
): void {
  graphics.clear();
  const { left, right, midWorldY, midWorldZ } = getViewportLeftRightWorld(
    canvas,
    screenProbe,
    worldScratch
  );
  const recycleX = left - GameConfig.recycleViewportMargin;
  const spawnLineX = right + spawnWorldMargin;
  const fillDisc = (worldX: number): void => {
    worldScratch.set(worldX, midWorldY, midWorldZ);
    uiTransform.convertToNodeSpaceAR(worldScratch, localOut);
    graphics.fillColor = DEBUG_FILL_COLOR;
    graphics.circle(localOut.x, localOut.y, DEBUG_RADIUS);
    graphics.fill();
  };
  fillDisc(left);
  fillDisc(recycleX);
  fillDisc(right);
  fillDisc(spawnLineX);
}
