<script lang="ts">
  import { SvelteFlow, Background, Controls } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import CustomNode from '$lib/components/CustomNode.svelte';

  const nodeTypes = {
    custom: CustomNode
  };

  import { canvasStore, type Canvas } from '$lib/stores/canvasStore';
  import { nodeStore, type Node } from '$lib/stores/nodeStore';
  import {
    toFlowNodes,
    handleNodeDragStop
  } from '$lib/graph/graphAdapter';

  let name = $state('');

  let canvases = $state<Canvas[]>([]);
  let activeCanvasId = $state<string | null>(null);
  let nodes = $state<Node[]>([]);

  let flowNodes = $state<any[]>([]);

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
  });

  $effect(() => {
    const unsub = nodeStore.subscribe((v) => {
      nodes = Array.from(v.nodes.values());
    });
    return unsub;
  });

  // derive flow nodes
  $effect(() => {
    flowNodes = toFlowNodes(nodes);
  });

  function addNode() {
    if (!activeCanvasId) return;

    // place near origin for now
    nodeStore.create(activeCanvasId, 100, 100);
  }
</script>

<div style="display: flex; height: 100vh; overflow: hidden;">
  <!-- LEFT PANEL -->
  <div class="sidebar">
    <h3>Canvases</h3>

    <input bind:value={name} placeholder="New canvas name" />
    <button onclick={() => canvasStore.create(name)}>Create</button>

    <ul>
      {#each canvases as canvas}
        <li>
          <button onclick={() => canvasStore.setActive(canvas.id)}>
            {canvas.name}
          </button>
          <button onclick={() => canvasStore.remove(canvas.id)}>X</button>
        </li>
      {/each}
    </ul>

    <hr />
    <button onclick={addNode}>+ Node</button>
  </div>

  <!-- CANVAS -->
  <div style="flex: 1; position: relative;">
    <SvelteFlow
        nodes={flowNodes}
        nodeTypes={nodeTypes}
        onnodedragstop={handleNodeDragStop}
        ondelete={(event) => {
          for (const node of event.nodes) {
            nodeStore.remove(node.id);
          }
        }}
        fitView
    >
      <Background />
      <Controls />
    </SvelteFlow>
  </div>
</div>