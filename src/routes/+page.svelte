<script lang="ts">
  import { onMount } from 'svelte';
  import { canvasStore } from '$lib/stores/canvasStore';
  import { nodeStore } from '$lib/stores/nodeStore';

  let name = $state('');

  let canvases = $state([]);
  let activeCanvasId = $state<string | null>(null);
  let nodes = $state([]);

  onMount(async () => {
    await canvasStore.load();
  });

  // subscribe to canvas store
  $effect(() => {
    const unsubscribe = canvasStore.subscribe((value) => {
      canvases = value.canvases;
      activeCanvasId = value.activeCanvasId;
    });

    return unsubscribe;
  });

  // load nodes when canvas changes
  $effect(() => {
    if (!activeCanvasId) return;

    nodeStore.load(activeCanvasId);
  });

  // subscribe to node store
  $effect(() => {
    const unsubscribe = nodeStore.subscribe((value) => {
      nodes = Array.from(value.nodes.values());
    });

    return unsubscribe;
  });
</script>

<h1>Mind Map MVP</h1>

<!-- Create Canvas -->
<input bind:value={name} placeholder="New canvas name" />
<button onclick={() => canvasStore.create(name)}>Create Canvas</button>

<hr />

<!-- Canvas List -->
<h2>Canvases</h2>
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

<!-- Nodes -->
{#if activeCanvasId}
  <h2>Nodes</h2>

  <button onclick={() => nodeStore.create(activeCanvasId, 100, 100)}>
    + Add Node
  </button>

  <ul>
    {#each nodes as node}
      <li>
        <input
          value={node.title}
          oninput={(e) =>
            nodeStore.updateNode({
              id: node.id,
              title: e.currentTarget.value
            })}
        />
        <button onclick={() => nodeStore.remove(node.id)}>Delete</button>
      </li>
    {/each}
  </ul>
{/if}