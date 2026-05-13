<script lang="ts">
	import {
		SvelteFlow,
		Background,
		Controls,
		ControlButton,
		type Connection,
	} from '@xyflow/svelte';
	import {
		CircleQuestionMark,
		RotateCcw,
		RotateCw,
		StickyNote,
		Shapes,
	} from 'lucide-svelte';
	import CustomNode from '$lib/components/CustomNode.svelte';
	import TopicNode from '$lib/components/TopicNode.svelte';
	import CanvasStageApiBridge from '$lib/components/CanvasStageApiBridge.svelte';
	import type { CanvasStageApi } from '$lib/canvasApi';
	import { handleNodeDragStop } from '$lib/graph/graphAdapter';

	const nodeTypes = {
		custom: CustomNode,
		topic: TopicNode,
	};

	interface Props {
		flowNodes: any[];
		flowEdges: any[];
		selectedNodeCount: number;
		onAddNode: () => void;
		onAddTopic: () => void;
		onUndo: () => void;
		onRedo: () => void;
		onHelp: () => void;
		canUndo: boolean;
		canRedo: boolean;
		canvasStatusLabel: string;
		mutationPhase: 'loading' | 'syncing' | 'synced' | 'failed';
		onConnect: (connection: Connection) => void;
		onNodeClick: (nodeId: string, shiftKey: boolean) => void;
		onEdgeClick: (edgeId: string) => void;
		onSelectionChange: (nodeIds: string[]) => void;
		onPaneClick: () => void;
		onDelete: (nodeIds: string[], edgeIds: string[]) => void | Promise<void>;
		onApiReady: (api: CanvasStageApi | null) => void;
	}

	let {
		flowNodes,
		flowEdges,
		selectedNodeCount,
		onAddNode,
		onAddTopic,
		onUndo,
		onRedo,
		onHelp,
		canUndo,
		canRedo,
		canvasStatusLabel,
		mutationPhase,
		onConnect,
		onNodeClick,
		onEdgeClick,
		onSelectionChange,
		onPaneClick,
		onDelete,
		onApiReady,
	}: Props = $props();
</script>

<div class="canvas-stage">
	<SvelteFlow
		style="width: 100%; height: 100%;"
		nodes={flowNodes}
		edges={flowEdges}
		{nodeTypes}
		proOptions={{ hideAttribution: true }}
		multiSelectionKey="Shift"
		onconnect={onConnect}
		onnodedragstop={handleNodeDragStop}
		onnodeclick={(event) => onNodeClick(event.node.id, event.event.shiftKey)}
		onedgeclick={({ edge }) => {
			if (edge.data?.kind !== 'associative') {
				return;
			}

			onEdgeClick(edge.id);
		}}
		onselectionchange={({ nodes }) =>
			onSelectionChange(nodes.map((node) => node.id))}
		onpaneclick={onPaneClick}
		ondelete={(event) => {
			onDelete(
				event.nodes.map((node) => node.id),
				event.edges.map((edge) => edge.id),
			);
		}}
		fitView
	>
		<CanvasStageApiBridge {onApiReady} />
		<Background />
		<Controls
			position="bottom-center"
			orientation="horizontal"
			class="canvas-controls"
			aria-label="Canvas controls"
		>
			<ControlButton
				onclick={onAddNode}
				class="canvas-controls__button canvas-controls__button--outline"
				aria-label="Add node"
				title="Add node (N)"
				data-testid="canvas-add-node"
			>
				<StickyNote class="canvas-controls__icon" size={12} aria-hidden="true" />
			</ControlButton>
			<ControlButton
				onclick={onAddTopic}
				class="canvas-controls__button canvas-controls__button--outline"
				aria-label="Add topic"
				title="Add topic (G)"
				data-testid="canvas-add-topic"
			>
				<Shapes class="canvas-controls__icon" size={12} aria-hidden="true" />
			</ControlButton>
			<ControlButton
				onclick={onUndo}
				class="canvas-controls__button canvas-controls__button--outline"
				aria-label="Undo"
				title="Undo (Cmd/Ctrl+Z)"
				data-testid="canvas-history-undo"
				disabled={!canUndo}
			>
				<RotateCcw class="canvas-controls__icon" size={12} aria-hidden="true" />
			</ControlButton>
			<ControlButton
				onclick={onRedo}
				class="canvas-controls__button canvas-controls__button--outline"
				aria-label="Redo"
				title="Redo (Cmd/Ctrl+Shift+Z)"
				data-testid="canvas-history-redo"
				disabled={!canRedo}
			>
				<RotateCw class="canvas-controls__icon" size={12} aria-hidden="true" />
			</ControlButton>
			<ControlButton
				onclick={onHelp}
				class="canvas-controls__button canvas-controls__button--outline"
				aria-label="Keyboard shortcuts help"
				title="Keyboard shortcuts help"
				data-testid="canvas-help"
			>
				<CircleQuestionMark
					class="canvas-controls__icon"
					size={12}
					aria-hidden="true"
				/>
			</ControlButton>
			<span class="canvas-controls__status-group">
				<span
					class="canvas-controls__status"
					class:canvas-controls__status--loading={mutationPhase === 'loading'}
					class:canvas-controls__status--syncing={mutationPhase === 'syncing'}
					class:canvas-controls__status--failed={mutationPhase === 'failed'}
					data-testid="canvas-sync-status"
					role="status"
					aria-live="polite"
					aria-atomic="true"
				>
					{canvasStatusLabel}
				</span>
				{#if selectedNodeCount > 0}
					<span
						class="canvas-controls__status"
						data-testid="canvas-selection-count"
						aria-live="polite"
						aria-atomic="true"
					>
						{selectedNodeCount} selected
					</span>
				{/if}
			</span>
		</Controls>
	</SvelteFlow>
</div>

<style>
	.canvas-stage {
		width: 100%;
		height: 100%;
		min-width: 0;
		min-height: 0;
	}

	:global(.canvas-shell .canvas-controls) {
		flex-direction: row;
		flex-wrap: nowrap;
		align-items: center;
		gap: 0;
	}

	.canvas-controls__status-group {
		display: inline-flex;
		flex: 0 0 auto;
		align-items: center;
		white-space: nowrap;
	}

	.canvas-controls__status {
		display: inline-flex;
		align-items: center;
		margin-left: 0.1rem;
		min-height: 26px;
		padding: 0 0.55rem;
		border-radius: 0;
		background: var(--xy-controls-button-background-color-default);
		box-shadow: none;
		color: var(--text-muted);
		font-size: 0.72rem;
		line-height: 1;
		white-space: nowrap;
	}

	.canvas-controls__status--loading {
		color: var(--accent);
	}

	.canvas-controls__status--syncing {
		color: #1d4ed8;
	}

	.canvas-controls__status--failed {
		color: #b91c1c;
	}

	:global(.canvas-shell .canvas-controls .canvas-controls__button--outline) {
		color: #000;
	}

	:global(.canvas-shell .canvas-controls .canvas-controls__button--outline:disabled) {
		opacity: 0.4;
	}

	:global(.canvas-shell .canvas-controls .canvas-controls__button--outline .canvas-controls__icon) {
		fill: none;
	}
</style>
