<script lang="ts">
  import { SvelteFlow, Background, Controls } from '@xyflow/svelte';
  import { onMount } from 'svelte';

  import { canvasStore } from '$lib/stores/canvasStore';
  import { nodeStore } from '$lib/stores/nodeStore';
  import { toFlowNodes, fromFlowPositionChange } from '$lib/graph/graphAdapter';

  let name = $state('');

  let canvases = $state([]);
  let activeCanvasId = $state<string | null>(null);
  let nodes = $state([]);

  let flowNodes = $state([]);

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

  function handleNodeDragStop(event) {
    const { id, position } = event;

    const update = fromFlowPositionChange(id, position);
    nodeStore.updateNode(update);
  }

  function addNode() {
    if (!activeCanvasId) return;

    // place near origin for now
    nodeStore.create(activeCanvasId, 100, 100);
  }
</script>

<div style="display: flex; height: 100vh; overflow: hidden;">
  <!-- LEFT PANEL -->
  <div style="width: 250px; border-right: 1px solid #ccc; padding: 8px;">
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
        onnodeDragStop={handleNodeDragStop}
        fitView
        style="width: 100%; height: 100%;"
    >
      <Background />
      <Controls />
    </SvelteFlow>
  </div>
</div>