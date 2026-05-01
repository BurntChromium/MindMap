<script lang="ts">
import { onMount } from 'svelte';
import type { Connection } from '@xyflow/svelte';
  import type { PageData } from './$types';
  import CanvasSidebar from '$lib/components/CanvasSidebar.svelte';
  import CanvasStage from '$lib/components/CanvasStage.svelte';
  import DiscoveryPanel from '$lib/components/DiscoveryPanel.svelte';
  import { collectTagSummaries, filterDiscoveryNodes } from '$lib/discovery';
  import {
    isCanvasToggleShortcut,
    isCreateNodeShortcut,
    isDiscoveryToggleShortcut,
    isTextInputElement
  } from '$lib/shortcutUtils';
  import { canvasStore, type Canvas } from '$lib/stores/canvasStore';
  import { edgeStore, type Edge } from '$lib/stores/edgeStore';
  import {
    buildTagColorMap,
    getActiveFilterLabel,
    getSearchHitIds,
    shouldBlockCreateNodeShortcut,
    shouldClearFocusedNode,
    toggleActiveTagFilter
  } from '$lib/routes/mindmapPage';
  import {
    nodeStore,
    type Node
  } from '$lib/stores/nodeStore';
  import { nodeUiStore } from '$lib/stores/nodeUiStore';
  import { toFlowEdges, toFlowNodes } from '$lib/graph/graphAdapter';

  let { data }: { data: PageData } = $props();

  let storeCanvases = $state<Canvas[] | null>(null);
  let storeActiveCanvasId = $state<string | null>(null);
  let storeNodes = $state.raw<Node[] | null>(null);
  let storeEdges = $state<Edge[] | null>(null);
  let searchQuery = $state('');
  let activeTag = $state<string | null>(null);
  let focusedNodeId = $state<string | null>(null);
  let editingNodeId = $state<string | null>(null);
  let sidebarCollapsed = $state(false);
  let discoveryCollapsed = $state(false);
  let loadedCanvasId = $state<string | null>(null);
  let initialHydrationDone = $state(false);
  let canvasShell: HTMLDivElement | undefined;

  const initialCanvases = $derived.by(() => data.canvases);
  const initialActiveCanvasId = $derived.by(() => data.activeCanvasId);
  const initialNodes = $derived.by(() => data.nodes);
  const initialEdges = $derived.by(() => data.edges);

  const canvases = $derived(storeCanvases ?? initialCanvases);
  const activeCanvasId = $derived(storeActiveCanvasId ?? initialActiveCanvasId);
  const nodes = $derived(storeNodes ?? initialNodes);
  const edges = $derived(storeEdges ?? initialEdges);
  const tagSummaries = $derived(collectTagSummaries(nodes));
  const tagColorMap = $derived(buildTagColorMap(tagSummaries));
  const searchResults = $derived(filterDiscoveryNodes(nodes, searchQuery, activeTag));
  const searchHitIds = $derived(getSearchHitIds(nodes, searchQuery, activeTag));
  const flowNodes = $derived(
    toFlowNodes(nodes, {
      editingNodeId,
      focusedNodeId,
      activeTag,
      searchHitIds,
      tagColors: tagColorMap,
      onTagClick: toggleTagFilter
    })
  );
  const flowEdges = $derived(toFlowEdges(edges));
  const activeFilterLabel = $derived(getActiveFilterLabel(searchQuery, activeTag));

  onMount(() => {
    canvasStore.hydrate(initialCanvases, initialActiveCanvasId);
    nodeStore.hydrate(initialNodes, initialActiveCanvasId);
    edgeStore.hydrate(initialEdges, initialActiveCanvasId);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (isTextInputElement(document.activeElement)) {
        return;
      }

      if (isCreateNodeShortcut(event)) {
        if (shouldBlockCreateNodeShortcut(document.activeElement, canvasShell, document.body)) {
          return;
        }

        event.preventDefault();
        addNode();
        return;
      }

      if (isCanvasToggleShortcut(event)) {
        event.preventDefault();
        sidebarCollapsed = !sidebarCollapsed;
        return;
      }

      if (isDiscoveryToggleShortcut(event)) {
        event.preventDefault();
        toggleDiscoveryPanel();
      }
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
    searchQuery = '';
    activeTag = null;
    focusedNodeId = null;
    void nodeStore.load(activeCanvasId);
    void edgeStore.load(activeCanvasId);
  });

  $effect(() => {
    if (shouldClearFocusedNode(focusedNodeId, searchQuery, activeTag, searchHitIds)) {
      focusedNodeId = null;
    }
  });

  function addNode() {
    if (!activeCanvasId) return;

    nodeStore.create(activeCanvasId, 100, 100);
  }

  function toggleTagFilter(tag: string) {
    activeTag = toggleActiveTagFilter(activeTag, tag);
    focusedNodeId = null;
  }

  function clearDiscoveryFilters() {
    searchQuery = '';
    activeTag = null;
    focusedNodeId = null;
  }

  function focusCanvasShell() {
    canvasShell?.focus();
  }

  function onConnect(connection: Connection) {
    if (!activeCanvasId || !connection.source || !connection.target) return;
    edgeStore.create(activeCanvasId, connection.source, connection.target);
  }

  function focusSearchResult(nodeId: string) {
    focusedNodeId = nodeId;
  }

  function toggleDiscoveryPanel() {
    discoveryCollapsed = !discoveryCollapsed;
  }

  function handleDeleteNodes(nodeIds: string[]) {
    for (const nodeId of nodeIds) {
      nodeStore.remove(nodeId);
    }
  }

  function handleDeleteEdges(edgeIds: string[]) {
    for (const edgeId of edgeIds) {
      edgeStore.remove(edgeId);
    }
  }
</script>

<div class="app-shell" class:app-shell--sidebar-collapsed={sidebarCollapsed}>
  <CanvasSidebar bind:collapsed={sidebarCollapsed} canvases={canvases} />

  <main class="workspace">
    <div
      bind:this={canvasShell}
      class="canvas-shell"
      tabindex="-1"
      role="region"
      aria-label="Mind map canvas"
      onpointerdown={focusCanvasShell}
    >
      <CanvasStage
        flowNodes={flowNodes}
        flowEdges={flowEdges}
        onAddNode={addNode}
        onConnect={onConnect}
        onNodeClick={(nodeId) => {
          focusedNodeId = nodeId;
        }}
        onDeleteNodes={handleDeleteNodes}
        onDeleteEdges={handleDeleteEdges}
      />
    </div>

    <DiscoveryPanel
      bind:collapsed={discoveryCollapsed}
      bind:searchQuery={searchQuery}
      activeTag={activeTag}
      focusedNodeId={focusedNodeId}
      tagSummaries={tagSummaries}
      searchResults={searchResults}
      activeFilterLabel={activeFilterLabel}
      onToggleTagFilter={toggleTagFilter}
      onClearFilters={clearDiscoveryFilters}
      onFocusSearchResult={focusSearchResult}
    />
  </main>
</div>

<style>
  .workspace {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: stretch;
    gap: 0;
  }

  @media (max-width: 1180px) {
    .workspace {
      flex-direction: column;
    }
  }
</style>
