<script lang="ts">
  import { SvelteFlow, Background, Controls, type Connection } from '@xyflow/svelte';
  import { Plus } from 'lucide-svelte';
  import CustomNode from '$lib/components/CustomNode.svelte';
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
    onSelectionChange: (nodeIds: string[]) => void;
    onPaneClick: () => void;
    onDeleteNodes: (nodeIds: string[]) => void;
    onDeleteEdges: (edgeIds: string[]) => void;
  }

  let {
    flowNodes,
    flowEdges,
    onAddNode,
    onConnect,
    onNodeClick,
    onSelectionChange,
    onPaneClick,
    onDeleteNodes,
    onDeleteEdges
  }: Props = $props();
</script>

<div class="canvas-stage">
  <div class="canvas-toolbar">
    <button
      class="button button--primary canvas-create-button"
      type="button"
      aria-label="Add node"
      title="Add node (N)"
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
    multiSelectionKey="Shift"
    onconnect={onConnect}
    onnodedragstop={handleNodeDragStop}
    onnodeclick={(event) => onNodeClick(event.node.id, event.event.shiftKey)}
    onselectionchange={({ nodes }) => onSelectionChange(nodes.map((node) => node.id))}
    onpaneclick={onPaneClick}
    ondelete={(event) => {
      onDeleteNodes(event.nodes.map((node) => node.id));
      onDeleteEdges(event.edges.map((edge) => edge.id));
    }}
    fitView
  >
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
