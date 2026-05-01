<script lang="ts">
  import { SvelteFlow, Background, Controls, type Connection } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { Plus, Trash2 } from 'lucide-svelte';
  import type { PageData } from './$types';
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

  let { data }: { data: PageData } = $props();

  let name = $state('');

  let storeCanvases = $state<Canvas[] | null>(null);
  let storeActiveCanvasId = $state<string | null>(null);
  let storeNodes = $state<Node[] | null>(null);
  let storeEdges = $state<Edge[] | null>(null);
  let editingNodeId = $state<string | null>(null);
  let loadedCanvasId = $state<string | null>(null);
  let initialHydrationDone = $state(false);

  const initialCanvases = $derived.by(() => data.canvases);
  const initialActiveCanvasId = $derived.by(() => data.activeCanvasId);
  const initialNodes = $derived.by(() => data.nodes);
  const initialEdges = $derived.by(() => data.edges);

  const canvases = $derived(storeCanvases ?? initialCanvases);
  const activeCanvasId = $derived(storeActiveCanvasId ?? initialActiveCanvasId);
  const nodes = $derived(storeNodes ?? initialNodes);
  const edges = $derived(storeEdges ?? initialEdges);
  const flowNodes = $derived(toFlowNodes(nodes, editingNodeId));
  const flowEdges = $derived(toFlowEdges(edges));
  let canvasShell: HTMLDivElement | undefined;

  onMount(() => {
    canvasStore.hydrate(initialCanvases, initialActiveCanvasId);
    nodeStore.hydrate(initialNodes);
    edgeStore.hydrate(initialEdges);

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

    const unsubCanvas = canvasStore.subscribe((v) => {
      storeCanvases = v.canvases;
      storeActiveCanvasId = v.activeCanvasId;
    });

    const unsubNodes = nodeStore.subscribe((v) => {
      storeNodes = Array.from(v.nodes.values());
    });

    const unsubEdges = edgeStore.subscribe((v) => {
      storeEdges = Array.from(v.edges.values());
    });

    const unsubNodeUi = nodeUiStore.subscribe((v) => {
      editingNodeId = v.editingNodeId;
    });

    loadedCanvasId = data.activeCanvasId;
    initialHydrationDone = true;

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubCanvas();
      unsubNodes();
      unsubEdges();
      unsubNodeUi();
    };
  });

  $effect(() => {
    if (!initialHydrationDone || !activeCanvasId || activeCanvasId === loadedCanvasId) return;
    loadedCanvasId = activeCanvasId;

    nodeUiStore.clear();
    void nodeStore.load(activeCanvasId);
    void edgeStore.load(activeCanvasId);
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
