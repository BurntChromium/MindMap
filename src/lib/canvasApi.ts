export type CanvasViewport = {
	x: number;
	y: number;
	zoom: number;
};

export type CanvasStageApi = {
	getViewport: () => CanvasViewport;
	getNodesBounds: (nodes: string[]) => {
		x: number;
		y: number;
		width: number;
		height: number;
	};
	setViewport: (viewport: CanvasViewport) => Promise<boolean>;
	zoomIn: () => Promise<boolean>;
	zoomOut: () => Promise<boolean>;
	setCenter: (
		x: number,
		y: number,
		options?: {
			zoom?: number;
			duration?: number;
		},
	) => Promise<boolean>;
	screenToFlowPosition: (
		position: {
			x: number;
			y: number;
		},
	) => {
		x: number;
		y: number;
	};
	flowToScreenPosition: (
		position: {
			x: number;
			y: number;
		},
	) => {
		x: number;
		y: number;
	};
};
