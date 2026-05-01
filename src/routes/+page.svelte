<script lang="ts">
  import { onMount } from 'svelte';
  import type { Connection } from '@xyflow/svelte';
  import type { PageData } from './$types';
  import { createClientId } from '$lib/clientId';
  import CanvasSidebar from '$lib/components/CanvasSidebar.svelte';
  import CanvasStage from '$lib/components/CanvasStage.svelte';
  import DiscoveryPanel from '$lib/components/DiscoveryPanel.svelte';
  import {
    buildClipboardFragment,
    buildPastedGraph,
    getConnectedEdgeIds,
    type ClipboardFragmentV1
  } from '$lib/graph/clipboard';
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
    buildBulkTagMutations,
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
  import { clipboardStore } from '$lib/stores/clipboardStore';
  import { toFlowEdges, toFlowNodes } from '$lib/graph/graphAdapter';
  import { selectionStore } from '$lib/stores/selectionStore';

  let { data }: { data: PageData } = $props();

  let storeCanvases = $state<Canvas[] | null>(null);
  let storeActiveCanvasId = $state<string | null>(null);
  let storeNodes = $state.raw<Node[] | null>(null);
  let storeEdges = $state<Edge[] | null>(null);
  let storeSelectedNodeIds = $state<string[] | null>(null);
  let storeClipboardFragment = $state<ClipboardFragmentV1 | null>(null);
  let storeClipboardPasteCount = $state(0);
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
  const selectedNodeIds = $derived(storeSelectedNodeIds ?? []);
  const clipboardFragment = $derived(storeClipboardFragment);
  const clipboardPasteCount = $derived(storeClipboardPasteCount);
  const selectedNodeIdSet = $derived(new Set(selectedNodeIds));
  const selectedNodes = $derived(nodes.filter((node) => selectedNodeIdSet.has(node.id)));
  const tagSummaries = $derived(collectTagSummaries(nodes));
  const tagColorMap = $derived(buildTagColorMap(tagSummaries));
  const selectedTagSummaries = $derived(collectTagSummaries(selectedNodes));
  const searchResults = $derived(filterDiscoveryNodes(nodes, searchQuery, activeTag));
  const searchHitIds = $derived(getSearchHitIds(nodes, searchQuery, activeTag));
  const flowNodes = $derived(
    toFlowNodes(nodes, {
      editingNodeId,
      focusedNodeId,
      selectedNodeIds,
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

      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        const key = event.key.toLowerCase();

        if (key === 'c' && selectedNodeIds.length > 0) {
          event.preventDefault();
          void copySelection();
          return;
        }

        if (key === 'x' && selectedNodeIds.length > 0) {
          event.preventDefault();
          void cutSelection();
          return;
        }

        if (key === 'v' && clipboardFragment) {
          event.preventDefault();
          void pasteClipboardFragment();
          return;
        }
      }

      if (isCreateNodeShortcut(event)) {
        if (shouldBlockCreateNodeShortcut(document.activeElement, canvasShell, document.body)) {
          return;
        }

        event.preventDefault();
        addNode();
        return;
      }

      if (event.key.toLowerCase() === 'a' && (event.metaKey || event.ctrlKey) && !event.altKey) {
        event.preventDefault();
        selectAllNodes();
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

    const unsubSelection = selectionStore.subscribe((value) => {
      storeSelectedNodeIds = value;
    });

    const unsubClipboard = clipboardStore.subscribe((value) => {
      storeClipboardFragment = value.fragment;
      storeClipboardPasteCount = value.pasteCount;
    });

    loadedCanvasId = data.activeCanvasId;
    initialHydrationDone = true;

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubCanvas();
      unsubNodes();
      unsubEdges();
      unsubNodeUi();
      unsubSelection();
      unsubClipboard();
    };
  });

  $effect(() => {
    if (!initialHydrationDone || !activeCanvasId || activeCanvasId === loadedCanvasId) return;
    loadedCanvasId = activeCanvasId;

    nodeUiStore.clear();
    selectionStore.clear();
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

  $effect(() => {
    if (selectedNodeIds.length === 0) {
      focusedNodeId = null;
      return;
    }

    if (!(searchQuery.trim() || activeTag) && (!focusedNodeId || !selectedNodeIds.includes(focusedNodeId))) {
      focusedNodeId = selectedNodeIds[0] ?? null;
    }
  });

  function addNode() {
    if (!activeCanvasId) return;

    nodeStore.create(activeCanvasId, 100, 100);
  }

  function selectAllNodes() {
    selectionStore.selectAll(nodes.map((node) => node.id));

    focusedNodeId = nodes[0]?.id ?? null;
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
    selectionStore.selectNode(nodeId);
  }

  function toggleDiscoveryPanel() {
    discoveryCollapsed = !discoveryCollapsed;
  }

  function copySelection() {
    const fragment = buildClipboardFragment(nodes, edges, selectedNodeIds, activeCanvasId);

    if (!fragment) {
      return;
    }

    clipboardStore.setFragment(fragment);

    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      const copyPromise = navigator.clipboard.writeText(JSON.stringify(fragment));
      void copyPromise.catch(() => undefined);
    }
  }

  async function cutSelection() {
    const fragment = buildClipboardFragment(nodes, edges, selectedNodeIds, activeCanvasId);

    if (!fragment) {
      return;
    }

    copySelection();
    await deleteGraphSelection(
      fragment.nodes.map((node) => node.id),
      getConnectedEdgeIds(edges, fragment.nodes.map((node) => node.id))
    );
  }

  async function deleteGraphSelection(nodeIds: string[], edgeIds: string[]) {
    if (!activeCanvasId) {
      return;
    }

    const uniqueNodeIds = Array.from(new Set(nodeIds));
    const uniqueEdgeIds = Array.from(new Set(edgeIds));
    const previousNodes = [...nodes];
    const previousEdges = [...edges];
    const previousSelection = [...selectedNodeIds];
    const previousFocusedNodeId = focusedNodeId;
    const nextSelection = previousSelection.filter((id) => !uniqueNodeIds.includes(id));
    const deletedNodeIdSet = new Set(uniqueNodeIds);
    const autoEdgeIds = getConnectedEdgeIds(edges, uniqueNodeIds);
    const deletedEdgeIds = Array.from(new Set([...uniqueEdgeIds, ...autoEdgeIds]));

    nodeStore.hydrate(
      previousNodes.filter((node) => !deletedNodeIdSet.has(node.id)),
      activeCanvasId
    );
    edgeStore.hydrate(
      previousEdges.filter((edge) => !deletedEdgeIds.includes(edge.id)),
      activeCanvasId
    );
    selectionStore.setSelection(nextSelection);

    if (previousFocusedNodeId && deletedNodeIdSet.has(previousFocusedNodeId)) {
      focusedNodeId = nextSelection[0] ?? null;
    }

    nodeUiStore.clear();

    try {
      const response = await fetch('/api/graph-fragments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          nodeIds: uniqueNodeIds,
          edgeIds: uniqueEdgeIds
        })
      });

      if (!response.ok) {
        throw new Error(`Delete graph fragment failed with ${response.status}`);
      }
    } catch (error) {
      nodeStore.hydrate(previousNodes, activeCanvasId);
      edgeStore.hydrate(previousEdges, activeCanvasId);
      selectionStore.setSelection(previousSelection);
      focusedNodeId = previousFocusedNodeId;
      console.error(error);
    }
  }

  function handleSelectionChange(nodeIds: string[]) {
    selectionStore.setSelection(nodeIds);
  }

  function handlePaneClick() {
    selectionStore.clear();
  }

  function addTagToSelection(tag: string) {
    const mutations = buildBulkTagMutations(selectedNodes, selectedNodeIds, tag, 'add');

    if (!mutations.length) {
      return;
    }

    void nodeStore.updateNodeTags(mutations);
  }

  function removeTagFromSelection(tag: string) {
    const mutations = buildBulkTagMutations(selectedNodes, selectedNodeIds, tag, 'remove');

    if (!mutations.length) {
      return;
    }

    void nodeStore.updateNodeTags(mutations);
  }

  function clearSelection() {
    selectionStore.clear();
  }

  async function pasteClipboardFragment() {
    if (!activeCanvasId || !clipboardFragment || clipboardFragment.nodes.length === 0) {
      return;
    }

    const pastedGraph = buildPastedGraph(
      clipboardFragment,
      activeCanvasId,
      clipboardPasteCount,
      () => createClientId('node'),
      () => createClientId('edge')
    );

    if (pastedGraph.nodes.length === 0) {
      return;
    }

    const previousNodes = [...nodes];
    const previousEdges = [...edges];
    const previousSelection = [...selectedNodeIds];
    const previousFocusedNodeId = focusedNodeId;
    const nextNodes = [...previousNodes, ...pastedGraph.nodes];
    const nextEdges = [...previousEdges, ...pastedGraph.edges];

    nodeStore.hydrate(nextNodes, activeCanvasId);
    edgeStore.hydrate(nextEdges, activeCanvasId);
    selectionStore.setSelection(pastedGraph.nodes.map((node) => node.id));
    focusedNodeId = pastedGraph.nodes[0]?.id ?? null;
    nodeUiStore.clear();

    try {
      const response = await fetch('/api/graph-fragments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'paste',
          canvasId: activeCanvasId,
          nodes: pastedGraph.nodes,
          edges: pastedGraph.edges
        })
      });

      if (!response.ok) {
        throw new Error(`Paste graph fragment failed with ${response.status}`);
      }

      clipboardStore.incrementPasteCount();
    } catch (error) {
      nodeStore.hydrate(previousNodes, activeCanvasId);
      edgeStore.hydrate(previousEdges, activeCanvasId);
      selectionStore.setSelection(previousSelection);
      focusedNodeId = previousFocusedNodeId;
      console.error(error);
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
        onNodeClick={(nodeId, shiftKey) => {
          focusedNodeId = nodeId;

          if (shiftKey) {
            selectionStore.toggleNode(nodeId);
            return;
          }

          selectionStore.selectNode(nodeId);
        }}
        onSelectionChange={handleSelectionChange}
        onPaneClick={handlePaneClick}
        onDelete={deleteGraphSelection}
      />
    </div>

    <DiscoveryPanel
      bind:collapsed={discoveryCollapsed}
      bind:searchQuery={searchQuery}
      activeTag={activeTag}
      focusedNodeId={focusedNodeId}
      selectedNodeCount={selectedNodeIds.length}
      selectedTagSummaries={selectedTagSummaries}
      tagSummaries={tagSummaries}
      searchResults={searchResults}
      activeFilterLabel={activeFilterLabel}
      onToggleTagFilter={toggleTagFilter}
      onClearFilters={clearDiscoveryFilters}
      onFocusSearchResult={focusSearchResult}
      onAddSelectedTag={addTagToSelection}
      onRemoveSelectedTag={removeTagFromSelection}
      onClearSelection={clearSelection}
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
