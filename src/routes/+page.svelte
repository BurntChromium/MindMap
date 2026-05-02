<script lang="ts">
  import { onMount } from 'svelte';
  import type { Connection } from '@xyflow/svelte';
  import { Search, X } from 'lucide-svelte';
  import type { PageData } from './$types';
  import { createClientId } from '$lib/clientId';
  import type { CanvasStageApi } from '$lib/canvasApi';
  import CanvasSidebar from '$lib/components/CanvasSidebar.svelte';
  import CanvasStage from '$lib/components/CanvasStage.svelte';
  import DiscoveryPanel from '$lib/components/DiscoveryPanel.svelte';
  import {
    buildClipboardFragment,
    buildPastedGraph,
    buildSubtreeClipboardFragment,
    getConnectedEdgeIds,
    type ClipboardFragmentV1
  } from '$lib/graph/clipboard';
  import { getNearestNodeInDirection, type Direction } from '$lib/graph/navigation';
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
    type Node,
    type NodePositionUpdate
  } from '$lib/stores/nodeStore';
  import { historyStore } from '$lib/stores/historyStore';
  import { mutationStateStore } from '$lib/stores/mutationStateStore';
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
  let storeMutationPhase = $state<'loading' | 'syncing' | 'synced' | 'failed'>('synced');
  let storeMutationError = $state<string | null>(null);
  let duplicateCount = $state(0);
  let bulkTagFocusSignal = $state(0);
  let searchQuery = $state('');
  let activeTag = $state<string | null>(null);
  let focusedNodeId = $state<string | null>(null);
  let editingNodeId = $state<string | null>(null);
  let sidebarCollapsed = $state(false);
  let discoveryCollapsed = $state(false);
  let quickSearchOpen = $state(false);
  let loadedCanvasId = $state<string | null>(null);
  let initialHydrationDone = $state(false);
  let canvasStageApi = $state<CanvasStageApi | null>(null);
  let nodeMoveQueue = Promise.resolve();
  let canvasShell: HTMLDivElement | undefined;
  let quickSearchInputRef = $state<HTMLInputElement | undefined>(undefined);

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
  const mutationPhase = $derived(storeMutationPhase);
  const mutationError = $derived(storeMutationError);
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
  const canvasStatusLabel = $derived(
    mutationPhase === 'loading'
      ? 'Loading'
      : mutationPhase === 'syncing'
        ? 'Syncing'
        : mutationPhase === 'failed'
          ? 'Failed'
          : 'Synced'
  );
  const canvasHasNodes = $derived(nodes.length > 0);
  const canvasIsLoading = $derived(mutationPhase === 'loading');
  const canvasIsFailed = $derived(mutationPhase === 'failed');
  const showCanvasEmptyState = $derived(
    Boolean(activeCanvasId) && !canvasHasNodes && !canvasIsLoading && !canvasIsFailed
  );
  const showCanvasLoadingState = $derived(
    Boolean(activeCanvasId) && !canvasHasNodes && canvasIsLoading
  );
  const showCanvasErrorState = $derived(Boolean(activeCanvasId) && !canvasHasNodes && canvasIsFailed);

  onMount(() => {
    canvasStore.hydrate(initialCanvases, initialActiveCanvasId);
    nodeStore.hydrate(initialNodes, initialActiveCanvasId);
    edgeStore.hydrate(initialEdges, initialActiveCanvasId);

    const handleKeyDown = (event: KeyboardEvent) => {
      const activeElement = document.activeElement;

      if (isTextInputElement(activeElement)) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && !event.altKey) {
        const key = event.key.toLowerCase();

        if (key === 'z') {
          event.preventDefault();
          if (event.shiftKey) {
            void redoHistory();
          } else {
            void undoHistory();
          }
          return;
        }

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

        if (key === 'd' && selectedNodeIds.length > 0) {
          event.preventDefault();
          if (event.shiftKey) {
            void duplicateSubtreeSelection();
          } else {
            void duplicateSelection();
          }
          return;
        }
      }

      if (
        event.key.toLowerCase() === 'a' &&
        (event.metaKey || event.ctrlKey) &&
        !event.altKey
      ) {
        event.preventDefault();
        selectAllNodes();
        return;
      }

      if (isCreateNodeShortcut(event)) {
        if (shouldBlockCreateNodeShortcut(activeElement, canvasShell, document.body)) {
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
        return;
      }

      if (
        !canvasShell ||
        !(activeElement instanceof HTMLElement) ||
        !canvasShell.contains(activeElement)
      ) {
        return;
      }

      if (event.key === 'Escape') {
        event.preventDefault();
        clearSelection();
        return;
      }

      if (event.key === 'Tab') {
        event.preventDefault();
        cycleFocusedNode(event.shiftKey);
        return;
      }

      if (event.key === ' ') {
        event.preventDefault();
        toggleFocusedNodeSelection();
        return;
      }

      if (event.key === '/') {
        event.preventDefault();
        openQuickSearch();
        return;
      }

      const direction = getCanvasDirectionFromKey(event.key);

      if (direction) {
        if (event.altKey && !event.metaKey && !event.ctrlKey) {
          event.preventDefault();
          focusNearestNode(direction, event.shiftKey);
          return;
        }

        if (event.metaKey || event.ctrlKey || event.altKey) {
          return;
        }

        event.preventDefault();
        const isArrowKey = event.key.startsWith('Arrow');

        if (isArrowKey && event.shiftKey) {
          moveSelectedNodes(direction, true);
          return;
        }

        if (isArrowKey) {
          moveSelectedNodes(direction, false);
          return;
        }

        panCanvas(direction);
        return;
      }

      if (event.key.toLowerCase() === 't') {
        event.preventDefault();
        focusBulkTagEditor();
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

    const unsubMutationState = mutationStateStore.subscribe((value) => {
      storeMutationPhase = value.phase;
      storeMutationError = value.lastError;
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
      unsubMutationState();
    };
  });

  $effect(() => {
    if (!initialHydrationDone || !activeCanvasId || activeCanvasId === loadedCanvasId) return;
    loadedCanvasId = activeCanvasId;

    nodeUiStore.clear();
    selectionStore.clear();
    duplicateCount = 0;
    searchQuery = '';
    activeTag = null;
    focusedNodeId = null;
    void loadActiveCanvas(activeCanvasId);
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
    quickSearchOpen = false;
  }

  function openQuickSearch() {
    quickSearchOpen = true;
    discoveryCollapsed = false;

    queueMicrotask(() => {
      quickSearchInputRef?.focus();
      quickSearchInputRef?.select();
    });
  }

  function closeQuickSearch() {
    quickSearchOpen = false;
    queueMicrotask(() => {
      canvasShell?.focus();
    });
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

  function getCanvasDirectionFromKey(key: string): Direction | null {
    switch (key.toLowerCase()) {
      case 'arrowleft':
      case 'h':
        return 'left';
      case 'arrowright':
      case 'l':
        return 'right';
      case 'arrowup':
      case 'k':
        return 'up';
      case 'arrowdown':
      case 'j':
        return 'down';
      default:
        return null;
    }
  }

  function getCanvasZoom() {
    return canvasStageApi?.getViewport().zoom ?? 1;
  }

  function getSelectionNodeIds() {
    if (selectedNodeIds.length > 0) {
      return selectedNodeIds;
    }

    return focusedNodeId ? [focusedNodeId] : [];
  }

  function getSelectionNodes() {
    const selectedIds = new Set(getSelectionNodeIds());
    return nodes.filter((node) => selectedIds.has(node.id));
  }

  function queueNodePositionUpdates(updates: NodePositionUpdate[]) {
    nodeMoveQueue = nodeMoveQueue
      .then(() => nodeStore.updateNodePositions(updates).then(() => undefined))
      .catch((error) => {
        console.error(error);
      });
  }

  function moveSelectedNodes(direction: Direction, accelerate = false) {
    const nodesToMove = getSelectionNodes();

    if (!nodesToMove.length) {
      return;
    }

    const zoom = getCanvasZoom();
    const baseStep = accelerate ? 72 : 24;
    const flowStep = baseStep / zoom;
    const delta =
      direction === 'left'
        ? { x: -flowStep, y: 0 }
        : direction === 'right'
          ? { x: flowStep, y: 0 }
          : direction === 'up'
            ? { x: 0, y: -flowStep }
            : { x: 0, y: flowStep };

    queueNodePositionUpdates(
      nodesToMove.map((node) => ({
        id: node.id,
        x: node.x + delta.x,
        y: node.y + delta.y
      }))
    );
  }

  function panCanvas(direction: Direction) {
    if (!canvasStageApi) {
      return;
    }

    const viewport = canvasStageApi.getViewport();
    const flowStep = 160 / viewport.zoom;
    const nextViewport =
      direction === 'left'
        ? { ...viewport, x: viewport.x + flowStep }
        : direction === 'right'
          ? { ...viewport, x: viewport.x - flowStep }
          : direction === 'up'
            ? { ...viewport, y: viewport.y + flowStep }
            : { ...viewport, y: viewport.y - flowStep };

    void canvasStageApi.setViewport(nextViewport);
  }

  function focusNearestNode(direction: Direction, extendSelection = false) {
    const originNodeId = focusedNodeId ?? selectedNodeIds[0] ?? null;

    if (!originNodeId) {
      return;
    }

    const nextNodeId = getNearestNodeInDirection(nodes, originNodeId, direction);

    if (!nextNodeId) {
      return;
    }

    focusedNodeId = nextNodeId;

    if (extendSelection) {
      selectionStore.setSelection([...selectedNodeIds, nextNodeId]);
    } else {
      selectionStore.selectNode(nextNodeId);
    }

    const nextNode = nodes.find((node) => node.id === nextNodeId);

    if (nextNode && canvasStageApi) {
      const currentZoom = canvasStageApi.getViewport().zoom;
      void canvasStageApi.setCenter(nextNode.x, nextNode.y, { zoom: currentZoom });
    }
  }

  function cycleFocusedNode(reverse = false) {
    const useFilteredNodes = searchQuery.trim() || activeTag;
    const candidates = useFilteredNodes ? searchResults : nodes;

    if (!candidates.length) {
      return;
    }

    const candidateIds = candidates.map((node) => node.id);
    const currentNodeId =
      (focusedNodeId && candidateIds.includes(focusedNodeId) ? focusedNodeId : null) ??
      selectedNodeIds.find((id) => candidateIds.includes(id)) ??
      null;
    const currentIndex = currentNodeId ? candidateIds.indexOf(currentNodeId) : -1;
    const nextIndex =
      currentIndex === -1
        ? reverse
          ? candidateIds.length - 1
          : 0
        : (currentIndex + (reverse ? -1 : 1) + candidateIds.length) % candidateIds.length;
    const nextNodeId = candidateIds[nextIndex];
    const nextNode = nodes.find((node) => node.id === nextNodeId);

    if (!nextNode) {
      return;
    }

    focusedNodeId = nextNodeId;
    selectionStore.selectNode(nextNodeId);

    if (canvasStageApi) {
      const currentZoom = canvasStageApi.getViewport().zoom;
      void canvasStageApi.setCenter(nextNode.x, nextNode.y, { zoom: currentZoom });
    }
  }

  function toggleFocusedNodeSelection() {
    const nodeId = focusedNodeId ?? selectedNodeIds[0] ?? null;

    if (!nodeId) {
      return;
    }

    selectionStore.toggleNode(nodeId);
  }

  function focusBulkTagEditor() {
    if (!selectedNodeIds.length) {
      return;
    }

    discoveryCollapsed = false;
    bulkTagFocusSignal += 1;
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

  async function applyPreparedGraph(
    graph: { nodes: Node[]; edges: Edge[] },
    onSuccess?: () => void
  ) {
    if (!activeCanvasId || graph.nodes.length === 0) {
      return false;
    }

    const previousNodes = [...nodes];
    const previousEdges = [...edges];
    const previousSelection = [...selectedNodeIds];
    const previousFocusedNodeId = focusedNodeId;
    const nextNodes = [...previousNodes, ...graph.nodes];
    const nextEdges = [...previousEdges, ...graph.edges];

    nodeStore.hydrate(nextNodes, activeCanvasId);
    edgeStore.hydrate(nextEdges, activeCanvasId);
    selectionStore.setSelection(graph.nodes.map((node) => node.id));
    focusedNodeId = graph.nodes[0]?.id ?? null;
    nodeUiStore.clear();

    try {
      const response = await fetch('/api/graph-fragments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'paste',
          canvasId: activeCanvasId,
          nodes: graph.nodes,
          edges: graph.edges
        })
      });

      if (!response.ok) {
        throw new Error(`Paste graph fragment failed with ${response.status}`);
      }

      onSuccess?.();
      return true;
    } catch (error) {
      nodeStore.hydrate(previousNodes, activeCanvasId);
      edgeStore.hydrate(previousEdges, activeCanvasId);
      selectionStore.setSelection(previousSelection);
      focusedNodeId = previousFocusedNodeId;
      console.error(error);
      return false;
    }
  }

  async function commitPastedGraph(
    fragment: ClipboardFragmentV1,
    pasteIndex: number,
    historyLabel = 'Paste nodes',
    onSuccess?: () => void
  ) {
    if (!activeCanvasId || fragment.nodes.length === 0) {
      return false;
    }

    const pastedGraph = buildPastedGraph(
      fragment,
      activeCanvasId,
      pasteIndex,
      () => createClientId('node'),
      () => createClientId('edge')
    );

    if (pastedGraph.nodes.length === 0) {
      return false;
    }

    const success = await applyPreparedGraph(pastedGraph, onSuccess);

    if (success && !historyStore.isReplaying()) {
      const pastedNodeIds = pastedGraph.nodes.map((node) => node.id);
      const pastedEdgeIds = pastedGraph.edges.map((edge) => edge.id);

      historyStore.record({
        label: historyLabel,
        undo: async () => deleteGraphSelection(pastedNodeIds, pastedEdgeIds),
        redo: async () => applyPreparedGraph(pastedGraph)
      });
    }

    return success;
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

  async function duplicateSelection() {
    const fragment = buildClipboardFragment(nodes, edges, selectedNodeIds, activeCanvasId);

    if (!fragment) {
      return;
    }

    await commitPastedGraph(fragment, duplicateCount, 'Duplicate nodes', () => {
      duplicateCount += 1;
    });
  }

  async function duplicateSubtreeSelection() {
    const fragment = buildSubtreeClipboardFragment(nodes, edges, selectedNodeIds, activeCanvasId);

    if (!fragment) {
      return;
    }

    await commitPastedGraph(fragment, duplicateCount, 'Duplicate subtree', () => {
      duplicateCount += 1;
    });
  }

  async function deleteGraphSelection(nodeIds: string[], edgeIds: string[]) {
    if (!activeCanvasId) {
      return false;
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
    const deletedNodes = previousNodes.filter((node) => deletedNodeIdSet.has(node.id));
    const deletedEdges = previousEdges.filter((edge) => deletedEdgeIds.includes(edge.id));

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
      return false;
    }

    if (!historyStore.isReplaying()) {
      historyStore.record({
        label: 'Delete nodes',
        undo: async () => applyPreparedGraph({ nodes: deletedNodes, edges: deletedEdges }),
        redo: async () => deleteGraphSelection(uniqueNodeIds, uniqueEdgeIds)
      });
    }

    return true;
  }

  function handleSelectionChange(nodeIds: string[]) {
    selectionStore.setSelection(nodeIds);
  }

  function handlePaneClick() {
    clearSelection();
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
    focusedNodeId = null;
  }

  async function pasteClipboardFragment() {
    if (!activeCanvasId || !clipboardFragment || clipboardFragment.nodes.length === 0) {
      return;
    }

    await commitPastedGraph(clipboardFragment, clipboardPasteCount, 'Paste nodes', () => {
      clipboardStore.incrementPasteCount();
    });
  }

  async function undoHistory() {
    await historyStore.undo();
  }

  async function redoHistory() {
    await historyStore.redo();
  }

  async function loadActiveCanvas(canvasId: string) {
    await Promise.all([nodeStore.load(canvasId), edgeStore.load(canvasId)]);
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
        onDelete={(nodeIds, edgeIds) => {
          void deleteGraphSelection(nodeIds, edgeIds);
        }}
        onApiReady={(api) => {
          canvasStageApi = api;
        }}
      />

      {#if selectedNodeIds.length > 0}
        <div class="canvas-hint canvas-hint--selection" aria-live="polite">
          {selectedNodeIds.length} selected
        </div>
      {/if}

      <div
        class="canvas-hint canvas-hint--status"
        class:canvas-hint--status-loading={mutationPhase === 'loading'}
        class:canvas-hint--status-syncing={mutationPhase === 'syncing'}
        class:canvas-hint--status-failed={mutationPhase === 'failed'}
        aria-live="polite"
      >
        {canvasStatusLabel}
      </div>

      {#if showCanvasLoadingState}
        <div class="canvas-empty-state" role="status" aria-live="polite">
          <h3>Loading canvas</h3>
          <p>Restoring the selected map.</p>
        </div>
      {:else if showCanvasErrorState}
        <div class="canvas-empty-state canvas-empty-state--error" role="alert">
          <h3>Could not refresh this canvas</h3>
          <p>{mutationError ?? 'Showing cached data if available.'}</p>
          <button class="button" type="button" onclick={() => activeCanvasId && void loadActiveCanvas(activeCanvasId)}>
            Retry
          </button>
        </div>
      {:else if showCanvasEmptyState}
        <div class="canvas-empty-state" role="status" aria-live="polite">
          <h3>No nodes yet</h3>
          <p>Press <kbd>N</kbd> to create a node on this canvas.</p>
        </div>
      {/if}

      {#if quickSearchOpen}
        <div class="canvas-search-bar">
          <Search size={14} aria-hidden="true" />
          <input
            bind:this={quickSearchInputRef}
            bind:value={searchQuery}
            class="canvas-search-bar__input"
            placeholder="Search nodes"
            aria-label="Search nodes"
            onkeydown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                closeQuickSearch();
              }
            }}
          />
          <button
            class="icon-button canvas-search-bar__clear"
            type="button"
            aria-label="Clear search"
            title="Clear search"
          onclick={() => {
            searchQuery = '';
            closeQuickSearch();
          }}
            disabled={!searchQuery.trim()}
          >
            <X size={12} aria-hidden="true" />
          </button>
        </div>
      {/if}
    </div>

    <DiscoveryPanel
      bind:collapsed={discoveryCollapsed}
      bind:searchQuery={searchQuery}
      activeTag={activeTag}
      focusedNodeId={focusedNodeId}
      selectedNodeCount={selectedNodeIds.length}
      focusBulkTagInputSignal={bulkTagFocusSignal}
      selectedTagSummaries={selectedTagSummaries}
      tagSummaries={tagSummaries}
      searchResults={searchResults}
      activeFilterLabel={activeFilterLabel}
      onToggleTagFilter={toggleTagFilter}
      onClearFilters={clearDiscoveryFilters}
      onFocusSearchResult={focusSearchResult}
      onAddSelectedTag={addTagToSelection}
      onRemoveSelectedTag={removeTagFromSelection}
      onDuplicateSelection={duplicateSelection}
      onDuplicateSubtree={duplicateSubtreeSelection}
      onClearSelection={clearSelection}
      onExitBulkTagInput={() => {
        focusedNodeId = selectedNodeIds[0] ?? focusedNodeId;
        queueMicrotask(() => {
          canvasShell?.focus();
        });
      }}
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

  .canvas-shell {
    position: relative;
    min-width: 0;
    min-height: 0;
  }

  .canvas-hint {
    position: absolute;
    z-index: 6;
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
    border: 1px solid rgba(148, 163, 184, 0.45);
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.92);
    box-shadow: var(--shadow-soft);
    color: var(--text-muted);
    font-size: 0.8rem;
    padding: 0.4rem 0.65rem;
    backdrop-filter: blur(8px);
  }

  .canvas-hint--selection {
    right: 1rem;
    bottom: 1rem;
  }

  .canvas-hint--status {
    left: 1rem;
    bottom: 1rem;
  }

  .canvas-hint--status-loading {
    background: rgba(255, 255, 255, 0.97);
    color: var(--accent);
  }

  .canvas-hint--status-syncing {
    background: rgba(239, 246, 255, 0.97);
    color: #1d4ed8;
  }

  .canvas-hint--status-failed {
    background: rgba(254, 242, 242, 0.97);
    color: #b91c1c;
    border-color: rgba(239, 68, 68, 0.4);
  }

  .canvas-empty-state {
    position: absolute;
    left: 50%;
    top: 50%;
    z-index: 5;
    display: grid;
    gap: 0.35rem;
    min-width: 280px;
    max-width: min(420px, calc(100% - 2rem));
    padding: 1rem 1.1rem;
    border: 1px solid rgba(148, 163, 184, 0.35);
    border-radius: 1rem;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: var(--shadow-soft);
    transform: translate(-50%, -50%);
    color: var(--text-main);
  }

  .canvas-empty-state h3 {
    margin: 0;
    font-size: 1rem;
  }

  .canvas-empty-state p {
    margin: 0;
    color: var(--text-muted);
  }

  .canvas-empty-state--error {
    border-color: rgba(239, 68, 68, 0.35);
  }

  .canvas-search-bar {
    position: absolute;
    right: 1rem;
    bottom: 3.5rem;
    z-index: 6;
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    min-width: 260px;
    padding: 0.5rem 0.65rem;
    border: 1px solid rgba(148, 163, 184, 0.45);
    border-radius: 0.9rem;
    background: rgba(255, 255, 255, 0.96);
    box-shadow: var(--shadow-soft);
    backdrop-filter: blur(10px);
  }

  .canvas-search-bar__input {
    flex: 1 1 auto;
    min-width: 0;
    border: 0;
    background: transparent;
    color: var(--text-main);
    outline: none;
  }

  .canvas-search-bar__input::placeholder {
    color: var(--text-muted);
  }

  .canvas-search-bar__clear {
    flex: 0 0 auto;
    width: 1.5rem;
    height: 1.5rem;
  }
</style>
