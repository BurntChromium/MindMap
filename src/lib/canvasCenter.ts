export type CanvasBounds = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type NodeFocusMode = 'compact' | 'view' | 'edit';

export function getCanvasBoundsCenter(bounds: CanvasBounds) {
  return {
    x: bounds.x + bounds.width / 2,
    y: bounds.y + bounds.height / 2
  };
}

type NodeFocusLayout = {
  width: number;
  height: number;
  anchorX: number;
  anchorY: number;
};

const NODE_FOCUS_LAYOUT: Record<NodeFocusMode, NodeFocusLayout> = {
  compact: {
    width: 180,
    height: 112,
    anchorX: 0.5,
    anchorY: 0.5
  },
  view: {
    width: 400,
    height: 168,
    anchorX: 0.5,
    anchorY: 0.5
  },
  edit: {
    width: 400,
    height: 216,
    anchorX: 0.75,
    anchorY: 0.5
  }
};

export function getNodeFocusPoint(position: Pick<CanvasBounds, 'x' | 'y'>, mode: NodeFocusMode) {
  const layout = NODE_FOCUS_LAYOUT[mode];

  return {
    x: position.x + layout.width * layout.anchorX,
    y: position.y + layout.height * layout.anchorY
  };
}

export function getNodeOriginForFocusPoint(
  focusPoint: Pick<CanvasBounds, 'x' | 'y'>,
  mode: NodeFocusMode
) {
  const layout = NODE_FOCUS_LAYOUT[mode];

  return {
    x: focusPoint.x - layout.width * layout.anchorX,
    y: focusPoint.y - layout.height * layout.anchorY
  };
}
