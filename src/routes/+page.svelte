<script lang="ts">
  import { SvelteFlow, Background, Controls, type Connection } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { Plus, Trash2 } from 'lucide-svelte';
  import CustomNode from '$lib/components/CustomNode.svelte';
  import { isCreateNodeShortcut, isTextInputElement } from '$lib/shortcutUtils';

  const nodeTypes = {
    custom: CustomNode
  };

  import { canvasStore, type Canvas } from '$lib/stores/canvasStore';
  import { nodeStore, type Node } from '$lib/stores/nodeStore';
  import { nodeUiStore } from '$lib/stores/nodeUiStore';
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
  let editingNodeId = $state<string | null>(null);

  let flowNodes = $state<any[]>([]);
  let flowEdges = $state<any[]>([]);
  let canvasShell: HTMLDivElement | undefined;

  onMount(() => {
    void canvasStore.load();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isCreateNodeShortcut(event)) {
        return;
      }

      const activeElement = document.activeElement;

      if (isTextInputElement(activeElement)) {
        return;
      }

      if (
        activeElement instanceof HTMLElement &&
        canvasShell &&
        !canvasShell.contains(activeElement) &&
        activeElement !== document.body
      ) {
        return;
      }

      event.preventDefault();
      addNode();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
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
    nodeUiStore.clear();
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

  $effect(() => {
    const unsub = nodeUiStore.subscribe((v) => {
      editingNodeId = v.editingNodeId;
    });
    return unsub;
  });

  // derive flow nodes/edges
  $effect(() => {
    flowNodes = toFlowNodes(nodes, editingNodeId);
    flowEdges = toFlowEdges(edges);
  });

  function addNode() {
    if (!activeCanvasId) return;

    // place near origin for now
    nodeStore.create(activeCanvasId, 100, 100);
  }

  function focusCanvasShell() {
    canvasShell?.focus();
  }

  function onConnect(connection: Connection) {
    if (!activeCanvasId || !connection.source || !connection.target) return;
    edgeStore.create(activeCanvasId, connection.source, connection.target);
  }
</script>

<div class="app-shell">
  <div class="sidebar">
    <div class="sidebar-section">
      <h3>Canvases</h3>
      <div class="sidebar-row">
        <input
          bind:value={name}
          class="sidebar-input"
          placeholder="New canvas"
          aria-label="New canvas name"
        />
        <button
          class="button button--primary"
          type="button"
          onclick={() => canvasStore.create(name)}
        >
          Create
        </button>
      </div>
    </div>

    <div class="sidebar-section">
      <ul class="sidebar-list">
        {#each canvases as canvas}
          <li class="sidebar-row">
            <button
              class="ghost-button"
              type="button"
              onclick={() => canvasStore.setActive(canvas.id)}
            >
              <span>{canvas.name}</span>
            </button>
            <button
              class="icon-button"
              type="button"
              aria-label={`Delete canvas ${canvas.name}`}
              title={`Delete canvas ${canvas.name}`}
              onclick={() => canvasStore.remove(canvas.id)}
            >
              <Trash2 size={14} aria-hidden="true" />
            </button>
          </li>
        {/each}
      </ul>
    </div>
  </div>

  <div
    bind:this={canvasShell}
    class="canvas-shell"
    tabindex="-1"
    role="region"
    aria-label="Mind map canvas"
    onpointerdown={focusCanvasShell}
  >
    <div class="canvas-toolbar">
      <button
        class="button button--primary canvas-create-button"
        type="button"
        aria-label="Add node"
        title="Add node (N)"
        onclick={addNode}
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
