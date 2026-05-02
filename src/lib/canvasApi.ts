export type CanvasViewport = {
  x: number;
  y: number;
  zoom: number;
};

export type CanvasStageApi = {
  getViewport: () => CanvasViewport;
  setViewport: (viewport: CanvasViewport) => Promise<boolean>;
  setCenter: (
    x: number,
    y: number,
    options?: {
      zoom?: number;
      duration?: number;
    }
  ) => Promise<boolean>;
};
