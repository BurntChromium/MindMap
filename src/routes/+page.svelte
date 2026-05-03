<script lang="ts">
  import { onDestroy, onMount, tick } from 'svelte';
  import type { Connection } from '@xyflow/svelte';
  import { Check, Search, X } from 'lucide-svelte';
  import { createClientId } from '$lib/clientId';
  import { appDataClient } from '$lib/appDataClient';
  import type { CanvasStageApi } from '$lib/canvasApi';
  import CanvasSidebar from '$lib/components/CanvasSidebar.svelte';
  import CanvasStage from '$lib/components/CanvasStage.svelte';
  import RightPanel from '$lib/components/RightPanel.svelte';
  import {
    buildClipboardFragment,
    buildPastedGraph,
    buildSubtreeClipboardFragment,
    getConnectedEdgeIds,
    type ClipboardFragmentV1
  } from '$lib/graph/clipboard';
  import { getNearestNodeInDirection, type Direction } from '$lib/graph/navigation';
  import { collectTagSummaries, createDiscoveryState } from '$lib/discovery';
  import {
    isCanvasToggleShortcut,
    isCreateNodeShortcut,
    isDiscoveryToggleShortcut,
    isZoomInShortcut,
    isZoomOutShortcut,
    isTextInputElement
  } from '$lib/shortcutUtils';
  import { canvasStore, type Canvas } from '$lib/stores/canvasStore';
  import { edgeStore, type Edge } from '$lib/stores/edgeStore';
  import {
    buildBulkTagMutations,
    buildTagColorMap,
    getActiveFilterLabel,
    shouldBlockCreateNodeShortcut,
    shouldClearFocusedNode,
    toggleActiveTagFilter
  } from '$lib/routes/mindmapPage';
  import {
    nodeStore,
    type Node,
    type NodePositionUpdate
  } from '$lib/stores/nodeStore';
  import { entityStore, type Entity, type EntityMention } from '$lib/stores/entityStore';
  import { historyStore } from '$lib/stores/historyStore';
  import { mutationStateStore } from '$lib/stores/mutationStateStore';
  import { nodeUiStore } from '$lib/stores/nodeUiStore';
  import { clipboardStore } from '$lib/stores/clipboardStore';
  import { toFlowEdges, toFlowNodes } from '$lib/graph/graphAdapter';
  import { buildAssociativeFlowEdges } from '$lib/graph/associativeEdges';
  import { selectionStore } from '$lib/stores/selectionStore';
  import {
    buildEntityInspectorEntries,
    findEntityInspectorEntryByTitle,
    getEntityInspectorNodeIds
  } from '$lib/entityInspector';
  import type { AppDataPageData } from '$lib/server/appData';

  let { data }: { data: AppDataPageData } = $props();

  let storeCanvases = $state<Canvas[] | null>(null);
  let storeActiveCanvasId = $state<string | null>(null);
  let storeNodes = $state.raw<Node[] | null>(null);
  let storeEdges = $state<Edge[] | null>(null);
  let storeEntities = $state.raw<Entity[] | null>(null);
  let storeEntityMentions = $state.raw<EntityMention[] | null>(null);
  let storeSelectedNodeIds = $state<string[] | null>(null);
  let storeClipboardFragment = $state<ClipboardFragmentV1 | null>(null);
  let storeClipboardPasteCount = $state(0);
  let storeMutationPhase = $state<'loading' | 'syncing' | 'synced' | 'failed'>('synced');
  let storeMutationError = $state<string | null>(null);
  let duplicateCount = $state(0);
  let bulkTagFocusSignal = $state(0);
  let searchQuery = $state('');
  let activeTag = $state<string | null>(null);
  let activePanelTab = $state<'search' | 'tags' | 'entities'>('search');
  let activeEntityId = $state<string | null>(null);
  let activeAssociativeEdgeId = $state<string | null>(null);
  let focusedNodeId = $state<string | null>(null);
  let editingNodeId = $state<string | null>(null);
  let previousEditingNodeId: string | null = null;
  let sidebarCollapsed = $state(false);
  let discoveryCollapsed = $state(false);
  let quickSearchOpen = $state(false);
  let loadedCanvasId = $state<string | null>(null);
  let initialHydrationDone = $state(false);
  let canvasStageApi = $state<CanvasStageApi | null>(null);
  let nodeMoveQueue = Promise.resolve();
  let canvasShell: HTMLDivElement | undefined;
  let quickSearchInputRef = $state<HTMLInputElement | undefined>(undefined);
  let exportNotice = $state<{ title: string; detail: string } | null>(null);
  let exportNoticeTimeout: ReturnType<typeof setTimeout> | null = null;

  const initialCanvases = $derived.by(() => data.canvases);
  const initialActiveCanvasId = $derived.by(() => data.activeCanvasId);
  const initialNodes = $derived.by(() => data.nodes);
  const initialEdges = $derived.by(() => data.edges);
  const initialEntities = $derived.by(() => data.entities);
  const initialEntityMentions = $derived.by(() => data.entityMentions);

  const canvases = $derived(storeCanvases ?? initialCanvases);
  const activeCanvasId = $derived(storeActiveCanvasId ?? initialActiveCanvasId);
  const nodes = $derived(storeNodes ?? initialNodes);
  const edges = $derived(storeEdges ?? initialEdges);
  const entities = $derived(storeEntities ?? initialEntities);
  const entityMentions = $derived(storeEntityMentions ?? initialEntityMentions);
  const selectedNodeIds = $derived(storeSelectedNodeIds ?? []);
  const clipboardFragment = $derived(storeClipboardFragment);
  const clipboardPasteCount = $derived(storeClipboardPasteCount);
  const mutationPhase = $derived(storeMutationPhase);
  const mutationError = $derived(storeMutationError);
  const selectedNodeIdSet = $derived(new Set(selectedNodeIds));
  const selectedNodes = $derived(nodes.filter((node) => selectedNodeIdSet.has(node.id)));
  const discoveryState = $derived(createDiscoveryState(nodes, searchQuery, activeTag));
  const tagSummaries = $derived(discoveryState.tagSummaries);
  const tagColorMap = $derived(buildTagColorMap(tagSummaries));
  const selectedTagSummaries = $derived(collectTagSummaries(selectedNodes));
  const searchResults = $derived(discoveryState.searchResults);
  const searchHitIds = $derived(discoveryState.searchHitIds);
  const entityInspectorEntries = $derived(
    buildEntityInspectorEntries(entities, entityMentions, nodes)
  );
  const associativeFlowEdges = $derived(
    buildAssociativeFlowEdges(nodes, entities, entityMentions)
  );
  const flowNodes = $derived(
    toFlowNodes(nodes, {
      editingNodeId,
      focusedNodeId,
      selectedNodeIds,
      activeTag,
      searchHitIds,
      tagColors: tagColorMap,
      onTagClick: toggleTagFilter,
      onEntityClick: focusEntityReference
    })
  );
  const flowEdges = $derived(toFlowEdges(edges, associativeFlowEdges));
  const activeAssociativeEdge = $derived(
    activeAssociativeEdgeId
      ? associativeFlowEdges.find((edge) => edge.id === activeAssociativeEdgeId) ?? null
      : null
  );
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

  function clearExportNoticeTimer() {
    if (exportNoticeTimeout) {
      clearTimeout(exportNoticeTimeout);
      exportNoticeTimeout = null;
    }
  }

  function dismissExportNotice() {
    clearExportNoticeTimer();
    exportNotice = null;
  }

  function showExportNotice(destinationLabel: string) {
    clearExportNoticeTimer();
    exportNotice = {
      title: 'Database exported',
      detail: destinationLabel
    };
    exportNoticeTimeout = setTimeout(() => {
      exportNotice = null;
      exportNoticeTimeout = null;
    }, 4500);
  }

  onDestroy(() => {
    clearExportNoticeTimer();
  });

  onMount(() => {
    canvasStore.hydrate(initialCanvases, initialActiveCanvasId);
    nodeStore.hydrate(initialNodes, initialActiveCanvasId);
    edgeStore.hydrate(initialEdges, initialActiveCanvasId);
    entityStore.hydrate(initialEntities, initialEntityMentions, initialActiveCanvasId);

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

      if (isZoomOutShortcut(event)) {
        if (!canvasShell || !(activeElement instanceof Element) || !canvasShell.contains(activeElement)) {
          return;
        }

        event.preventDefault();
        void zoomCanvas(-1);
        return;
      }

      if (isZoomInShortcut(event)) {
        if (!canvasShell || !(activeElement instanceof Element) || !canvasShell.contains(activeElement)) {
          return;
        }

        event.preventDefault();
        void zoomCanvas(1);
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

      if (
        event.key.toLowerCase() === 'e' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        const nodeId = getSingleSelectedNodeId();

        if (!nodeId || editingNodeId) {
          return;
        }

        event.preventDefault();
        void beginEditingNode(nodeId);
        return;
      }

      if (
        event.key.toLowerCase() === 'v' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        const nodeId = getSingleSelectedNodeId();

        if (!nodeId || editingNodeId) {
          return;
        }

        event.preventDefault();
        nodeUiStore.toggleExpanded(nodeId);
        return;
      }

      if (
        event.key.toLowerCase() === 'w' &&
        !event.metaKey &&
        !event.ctrlKey &&
        !event.altKey &&
        !event.shiftKey
      ) {
        if (!editingNodeId) {
          return;
        }

        event.preventDefault();
        void focusEditingNodeTitle();
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

    const unsubEntities = entityStore.subscribe((v) => {
      storeEntities = v.entities;
      storeEntityMentions = v.mentions;
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

    if (typeof window !== 'undefined' && window.__TAURI__) {
      void canvasStore.load();
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      unsubCanvas();
      unsubNodes();
      unsubEdges();
      unsubEntities();
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
    activePanelTab = 'search';
    activeEntityId = null;
    focusedNodeId = null;
    void loadActiveCanvas(activeCanvasId);
  });

  $effect(() => {
    if (previousEditingNodeId && !editingNodeId) {
      queueMicrotask(() => {
        canvasShell?.focus();
      });
    }

    previousEditingNodeId = editingNodeId;
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

  $effect(() => {
    if (!activeEntityId) {
      return;
    }

    if (!entityInspectorEntries.some((entry) => entry.id === activeEntityId)) {
      activeEntityId = null;
    }
  });

  $effect(() => {
    if (!activeAssociativeEdgeId) {
      return;
    }

    if (!associativeFlowEdges.some((edge) => edge.id === activeAssociativeEdgeId)) {
      activeAssociativeEdgeId = null;
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
    focusNode(nodeId);
  }

  function focusNode(nodeId: string, options: { select?: boolean } = {}) {
    const { select = true } = options;
    focusedNodeId = nodeId;
    activeAssociativeEdgeId = null;

    if (select) {
      selectionStore.selectNode(nodeId);
    }

    const nextNode = nodes.find((node) => node.id === nodeId);

    if (nextNode && canvasStageApi) {
      const currentZoom = canvasStageApi.getViewport().zoom;
      void canvasStageApi.setCenter(nextNode.x, nextNode.y, { zoom: currentZoom });
    }
  }

  function focusEntityReference(title: string) {
    const entry = findEntityInspectorEntryByTitle(entityInspectorEntries, title);

    if (!entry) {
      return;
    }

    const nodeIds = getEntityInspectorNodeIds(entry);

    discoveryCollapsed = false;
    activePanelTab = 'entities';
    activeEntityId = entry.id;
    activeAssociativeEdgeId = null;

    if (entry.primaryNode) {
      focusNode(entry.primaryNode.id, { select: false });
    }

    selectionStore.setSelection(nodeIds);
  }

  function toggleDiscoveryPanel() {
    discoveryCollapsed = !discoveryCollapsed;
  }

  function inspectAssociativeEdge(edgeId: string) {
    const edge = associativeFlowEdges.find((candidate) => candidate.id === edgeId);

    if (!edge) {
      return;
    }

    discoveryCollapsed = false;
    activePanelTab = 'entities';
    activeEntityId = null;
    activeAssociativeEdgeId = activeAssociativeEdgeId === edgeId ? null : edgeId;
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

  function getSingleSelectedNodeId() {
    return selectedNodeIds.length === 1 ? selectedNodeIds[0] ?? null : null;
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

  async function zoomCanvas(direction: -1 | 1) {
    if (!canvasStageApi) {
      return;
    }

    if (direction === -1) {
      await canvasStageApi.zoomOut();
      return;
    }

    await canvasStageApi.zoomIn();
  }

  async function beginEditingNode(nodeId: string) {
    const nextNode = nodes.find((node) => node.id === nodeId);

    if (!nextNode) {
      return;
    }
    focusedNodeId = nodeId;
    selectionStore.selectNode(nodeId);
    nodeUiStore.beginEdit(nodeId);

    if (canvasStageApi) {
      const currentZoom = canvasStageApi.getViewport().zoom;
      void canvasStageApi.setCenter(nextNode.x, nextNode.y, { zoom: currentZoom });
    }

  }

  async function focusEditingNodeTitle() {
    await tick();

    const titleInput = document.querySelector<HTMLInputElement>('.title-input');

    if (!titleInput) {
      return;
    }

    titleInput.focus();
    titleInput.select();
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
    activePanelTab = 'tags';
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
      const responseBody = (await appDataClient.mutateGraphFragment({
        action: 'paste',
        canvasId: activeCanvasId,
        nodes: graph.nodes,
        edges: graph.edges
      })) as { insertedNodes?: Array<{ id?: unknown; title?: unknown }> } | null;
      const insertedNodes = Array.isArray(responseBody?.insertedNodes)
        ? (responseBody.insertedNodes as Array<{ id?: unknown; title?: unknown }>)
        : null;

      if (insertedNodes) {
        const insertedTitleById = new Map(
          insertedNodes
            .filter((node): node is { id: string; title: string } => {
              return typeof node.id === 'string' && typeof node.title === 'string';
            })
            .map((node) => [node.id, node.title])
        );
        const reconciledNodes = nextNodes.map((node) =>
          insertedTitleById.has(node.id)
            ? {
                ...node,
                title: insertedTitleById.get(node.id) ?? node.title
              }
            : node
          );

        graph.nodes = reconciledNodes;
        nodeStore.hydrate(reconciledNodes, activeCanvasId);
      }

      await entityStore.load(activeCanvasId);
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
      () => createClientId('edge'),
      nodes
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
      await appDataClient.mutateGraphFragment({
        action: 'delete',
        nodeIds: uniqueNodeIds,
        edgeIds: uniqueEdgeIds
      });
    } catch (error) {
      nodeStore.hydrate(previousNodes, activeCanvasId);
      edgeStore.hydrate(previousEdges, activeCanvasId);
      selectionStore.setSelection(previousSelection);
      focusedNodeId = previousFocusedNodeId;
      console.error(error);
      return false;
    }

    await entityStore.load(activeCanvasId);

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
    activeAssociativeEdgeId = null;
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
    activeAssociativeEdgeId = null;
    await Promise.all([
      nodeStore.load(canvasId),
      edgeStore.load(canvasId),
      entityStore.load(canvasId)
    ]);
  }
</script>

<div class="app-shell" class:app-shell--sidebar-collapsed={sidebarCollapsed}>
  <CanvasSidebar
    bind:collapsed={sidebarCollapsed}
    canvases={canvases}
    onExportSuccess={showExportNotice}
  />

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
          if (shiftKey) {
            focusedNodeId = nodeId;
            selectionStore.toggleNode(nodeId);
            return;
          }

          focusNode(nodeId);
        }}
        onEdgeClick={(edgeId) => {
          inspectAssociativeEdge(edgeId);
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

      {#if exportNotice}
        <div class="canvas-toast" role="status" aria-live="polite" aria-atomic="true">
          <div class="canvas-toast__icon" aria-hidden="true">
            <Check size={14} />
          </div>
          <div class="canvas-toast__body">
            <strong class="canvas-toast__title">{exportNotice.title}</strong>
            <span class="canvas-toast__detail">{exportNotice.detail}</span>
          </div>
          <button
            class="icon-button canvas-toast__dismiss"
            type="button"
            aria-label="Dismiss export notification"
            title="Dismiss export notification"
            onclick={dismissExportNotice}
          >
            <X size={12} aria-hidden="true" />
          </button>
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

    <RightPanel
      bind:collapsed={discoveryCollapsed}
      bind:searchQuery={searchQuery}
      bind:activeTab={activePanelTab}
      bind:activeEntityId={activeEntityId}
      activeTag={activeTag}
      focusedNodeId={focusedNodeId}
      selectedNodeCount={selectedNodeIds.length}
      focusBulkTagInputSignal={bulkTagFocusSignal}
      selectedTagSummaries={selectedTagSummaries}
      tagSummaries={tagSummaries}
      searchResults={searchResults}
      activeFilterLabel={activeFilterLabel}
      entityEntries={entityInspectorEntries}
      activeAssociativeEdge={activeAssociativeEdge}
      onToggleTagFilter={toggleTagFilter}
      onClearFilters={clearDiscoveryFilters}
      onFocusSearchResult={focusSearchResult}
      onFocusEntityNode={focusNode}
      onFocusEntityTitle={focusEntityReference}
      onClearAssociativeEdge={() => {
        activeAssociativeEdgeId = null;
      }}
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

  .canvas-toast {
    position: absolute;
    right: 1rem;
    top: 1rem;
    z-index: 7;
    display: flex;
    align-items: flex-start;
    gap: 0.7rem;
    min-width: min(320px, calc(100% - 2rem));
    max-width: min(420px, calc(100% - 2rem));
    padding: 0.85rem 0.95rem;
    border: 1px solid rgba(34, 197, 94, 0.34);
    border-radius: 1rem;
    background: rgba(240, 253, 244, 0.97);
    box-shadow: var(--shadow-soft);
    color: #166534;
    backdrop-filter: blur(8px);
  }

  .canvas-toast__icon {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 1.35rem;
    height: 1.35rem;
    border-radius: 999px;
    background: rgba(34, 197, 94, 0.14);
    color: #166534;
  }

  .canvas-toast__body {
    display: grid;
    gap: 0.15rem;
    min-width: 0;
    flex: 1;
  }

  .canvas-toast__title {
    font-size: 0.92rem;
    line-height: 1.2;
  }

  .canvas-toast__detail {
    font-size: 0.82rem;
    line-height: 1.35;
    color: rgba(22, 101, 52, 0.82);
    word-break: break-word;
  }

  .canvas-toast__dismiss {
    flex: none;
    margin-left: auto;
    color: #166534;
  }

  .canvas-hint--status {
    left: 3.75rem;
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
