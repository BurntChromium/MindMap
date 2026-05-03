export type CanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export function getCanvasBoundsCenter(bounds: CanvasBounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
}
