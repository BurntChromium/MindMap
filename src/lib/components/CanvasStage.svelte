<script lang="ts">
  import { SvelteFlow, Background, Controls, type Connection } from '@xyflow/svelte';
  import { Plus } from 'lucide-svelte';
  import CustomNode from '$lib/components/CustomNode.svelte';
  import CanvasStageApiBridge from '$lib/components/CanvasStageApiBridge.svelte';
  import type { CanvasStageApi } from '$lib/canvasApi';
  import { handleNodeDragStop } from '$lib/graph/graphAdapter';

  const nodeTypes = {
    custom: CustomNode
  };

  interface Props {
    flowNodes: any[];
    flowEdges: any[];
    onAddNode: () => void;
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
    onAddNode,
    onConnect,
    onNodeClick,
    onEdgeClick,
    onSelectionChange,
    onPaneClick,
    onDelete,
    onApiReady
  }: Props = $props();
</script>

<div class="canvas-stage">
  <div class="canvas-toolbar">
    <button
      class="button button--primary canvas-create-button"
      type="button"
      aria-label="Add node"
      title="Add node (N)"
      data-testid="canvas-add-node"
      onclick={onAddNode}
    >
      <Plus size={16} aria-hidden="true" />
      <span>Node</span>
    </button>
  </div>

  <SvelteFlow
    style="width: 100%; height: 100%;"
    nodes={flowNodes}
    edges={flowEdges}
    nodeTypes={nodeTypes}
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
    onselectionchange={({ nodes }) => onSelectionChange(nodes.map((node) => node.id))}
    onpaneclick={onPaneClick}
    ondelete={(event) => {
      onDelete(
        event.nodes.map((node) => node.id),
        event.edges.map((edge) => edge.id)
      );
    }}
    fitView
  >
    <CanvasStageApiBridge {onApiReady} />
    <Background />
    <Controls />
  </SvelteFlow>
</div>

<style>
  .canvas-stage {
    width: 100%;
    height: 100%;
    min-width: 0;
    min-height: 0;
  }
</style>
