<script lang="ts">
  import { SvelteFlow, Background, Controls, type Connection } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { Check, ChevronLeft, ChevronRight, PencilLine, Plus, Trash2, X } from 'lucide-svelte';
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
  let editingCanvasId = $state<string | null>(null);
  let editingCanvasName = $state('');
  let sidebarCollapsed = $state(false);
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

  function startRenameCanvas(canvas: Canvas) {
    editingCanvasId = canvas.id;
    editingCanvasName = canvas.name;
  }

  async function saveCanvasName(canvasId: string) {
    await canvasStore.rename(canvasId, editingCanvasName);
    editingCanvasId = null;
    editingCanvasName = '';
  }

  function cancelRenameCanvas() {
    editingCanvasId = null;
    editingCanvasName = '';
  }

  function shouldSaveCanvasRename(event: FocusEvent) {
    const relatedTarget = event.relatedTarget;

    return !(
      relatedTarget instanceof HTMLElement &&
      relatedTarget.closest('.sidebar-row-actions') !== null
    );
  }

  function focusCanvasShell() {
    canvasShell?.focus();
  }

  function onConnect(connection: Connection) {
    if (!activeCanvasId || !connection.source || !connection.target) return;
    edgeStore.create(activeCanvasId, connection.source, connection.target);
  }
</script>

<div class="app-shell" class:app-shell--sidebar-collapsed={sidebarCollapsed}>
  <div class="sidebar" class:sidebar--collapsed={sidebarCollapsed}>
    <div class="sidebar-topbar">
      <h3>{sidebarCollapsed ? 'C' : 'Canvases'}</h3>
      <button
        class="icon-button sidebar-toggle"
        type="button"
        aria-label={sidebarCollapsed ? 'Expand left panel' : 'Collapse left panel'}
        title={sidebarCollapsed ? 'Expand left panel' : 'Collapse left panel'}
        aria-expanded={!sidebarCollapsed}
        onclick={() => (sidebarCollapsed = !sidebarCollapsed)}
      >
        {#if sidebarCollapsed}
          <ChevronRight size={14} aria-hidden="true" />
        {:else}
          <ChevronLeft size={14} aria-hidden="true" />
        {/if}
      </button>
    </div>

    <div class="sidebar-section">
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
          <span>Create</span>
        </button>
      </div>
    </div>

    <div class="sidebar-section">
      <ul class="sidebar-list">
        {#each canvases as canvas}
          <li class="sidebar-row sidebar-canvas-row">
            {#if editingCanvasId === canvas.id}
              <input
                bind:value={editingCanvasName}
                class="sidebar-input sidebar-canvas-input"
                aria-label={`Rename canvas ${canvas.name}`}
                onkeydown={async (event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault();
                    await saveCanvasName(canvas.id);
                  }

                  if (event.key === 'Escape') {
                    event.preventDefault();
                    cancelRenameCanvas();
                  }
                }}
                onblur={async (event) => {
                  if (!shouldSaveCanvasRename(event)) {
                    return;
                  }

                  await saveCanvasName(canvas.id);
                }}
              />
            {:else}
              <button
                class="ghost-button sidebar-canvas-button"
                type="button"
                onclick={() => canvasStore.setActive(canvas.id)}
              >
                <span>{canvas.name}</span>
              </button>
            {/if}

            <div class="sidebar-row-actions">
              {#if editingCanvasId === canvas.id}
                <button
                  class="icon-button"
                  type="button"
                  aria-label={`Save canvas name ${canvas.name}`}
                  title={`Save canvas name ${canvas.name}`}
                  onclick={() => saveCanvasName(canvas.id)}
                >
                  <Check size={14} aria-hidden="true" />
                </button>
                <button
                  class="icon-button"
                  type="button"
                  aria-label={`Cancel rename for ${canvas.name}`}
                  title={`Cancel rename for ${canvas.name}`}
                  onclick={cancelRenameCanvas}
                >
                  <X size={14} aria-hidden="true" />
                </button>
              {:else}
                <button
                  class="icon-button"
                  type="button"
                  aria-label={`Rename canvas ${canvas.name}`}
                  title={`Rename canvas ${canvas.name}`}
                  onclick={() => startRenameCanvas(canvas)}
                >
                  <PencilLine size={14} aria-hidden="true" />
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
              {/if}
            </div>
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
