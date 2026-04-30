<script lang="ts">
  import { SvelteFlow, Background, Controls, type Connection, addEdge } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import CustomNode from '$lib/components/CustomNode.svelte';
  import trash from '$lib/assets/trash-icon.svg';

  const nodeTypes = {
    custom: CustomNode
  };

  import { canvasStore, type Canvas } from '$lib/stores/canvasStore';
  import { nodeStore, type Node } from '$lib/stores/nodeStore';
  import { edgeStore, type Edge } from '$lib/stores/edgeStore';
  import {
    toFlowNodes,
    toFlowEdges,
    handleNodeDragStop
  } from '$lib/graph/graphAdapter';

  let name = $state('');

  let canvases = $state<Canvas[]>([]);
  let activeCanvasId = $state<string | null>(null);
  let nodes = $state<Node[]>([]);
  let edges = $state<Edge[]>([]);

  let flowNodes = $state<any[]>([]);
  let flowEdges = $state<any[]>([]);

  onMount(async () => {
    await canvasStore.load();
  });

  $effect(() => {
    const unsub = canvasStore.subscribe((v) => {
      canvases = v.canvases;
      activeCanvasId = v.activeCanvasId;
    });
    return unsub;
  });

  $effect(() => {
    if (!activeCanvasId) return;
    nodeStore.load(activeCanvasId);
    edgeStore.load(activeCanvasId);
  });

  $effect(() => {
    const unsub = nodeStore.subscribe((v) => {
      nodes = Array.from(v.nodes.values());
    });
    return unsub;
  });

  $effect(() => {
    const unsub = edgeStore.subscribe((v) => {
      edges = Array.from(v.edges.values());
    });
    return unsub;
  });

  // derive flow nodes/edges
  $effect(() => {
    flowNodes = toFlowNodes(nodes);
    flowEdges = toFlowEdges(edges);
  });

  function addNode() {
    if (!activeCanvasId) return;

    // place near origin for now
    nodeStore.create(activeCanvasId, 100, 100);
  }

  function onConnect(connection: Connection) {
    if (!activeCanvasId || !connection.source || !connection.target) return;
    edgeStore.create(activeCanvasId, connection.source, connection.target);
  }
</script>

<div style="display: flex; height: 100vh; overflow: hidden;">
  <!-- LEFT PANEL -->
  <div class="sidebar">
    <h3>Canvas List</h3>

    <input bind:value={name} placeholder="New canvas name" />
    <button class="primary-button" onclick={() => canvasStore.create(name)}>Create</button>

    <ul>
      {#each canvases as canvas}
        <li>
          <button 
            class="implied-button"
            onclick={() => canvasStore.setActive(canvas.id)}>
            {canvas.name}
          </button>
          <button class="icon-button" onclick={() => canvasStore.remove(canvas.id)}>
            <img src={trash} alt="trashcan icon" height="15px"/>
          </button>
        </li>
      {/each}
    </ul>

    <button class="primary-button" onclick={addNode}>Add Node</button>
  </div>

  <!-- CANVAS -->
  <div style="flex: 1; position: relative;">
    <SvelteFlow
        <SvelteFlow
            nodes={flowNodes}
            edges={flowEdges}
            nodeTypes={nodeTypes}
            onconnect={onConnect}
            onnodedragstop={handleNodeDragStop}
            ondelete={(event) => {
              for (const node of event.nodes) {
                nodeStore.remove(node.id);
              }
              for (const edge of event.edges) {
                edgeStore.remove(edge.id);
              }
            }}
            fitView
        >
          <Background />
          <Controls />
        </SvelteFlow>
  </div>
</div>