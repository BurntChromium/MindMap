<script lang="ts">
  import { SvelteFlow, Background, Controls, type Connection } from '@xyflow/svelte';
  import { onMount } from 'svelte';
  import { Check, ChevronLeft, ChevronRight, PencilLine, Plus, Trash2, X } from 'lucide-svelte';
  import type { PageData } from './$types';
  import CustomNode from '$lib/components/CustomNode.svelte';
  import { collectTagSummaries } from '$lib/discovery';
  import { formatTagLabel, normalizeTagName } from '$lib/tagUtils';
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
  let searchQuery = $state('');
  let searchResults = $state<Node[]>([]);
  let searchLoading = $state(false);
  let searchError = $state<string | null>(null);
  let activeTag = $state<string | null>(null);
  let focusedNodeId = $state<string | null>(null);
  let editingNodeId = $state<string | null>(null);
  let editingCanvasId = $state<string | null>(null);
  let editingCanvasName = $state('');
  let sidebarCollapsed = $state(false);
  let discoveryCollapsed = $state(false);
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
  const tagSummaries = $derived(collectTagSummaries(nodes));
  const tagColorMap = $derived(
    Object.fromEntries(tagSummaries.map((tag) => [tag.name, tag.color]))
  );
  const searchHitIds = $derived(new Set(searchResults.map((node) => node.id)));
  const flowNodes = $derived(
    toFlowNodes(nodes, {
      editingNodeId,
      focusedNodeId,
      activeTag,
      searchHitIds,
      tagColors: tagColorMap
    })
  );
  const flowEdges = $derived(toFlowEdges(edges));
  const activeFilterLabel = $derived.by(() => {
    const filters: string[] = [];

    if (searchQuery.trim()) {
      filters.push(`"${searchQuery.trim()}"`);
    }

    if (activeTag) {
      filters.push(formatTagLabel(activeTag));
    }

    return filters.length ? filters.join(' + ') : 'none';
  });
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
    searchQuery = '';
    searchResults = [];
    searchLoading = false;
    searchError = null;
    activeTag = null;
    focusedNodeId = null;
    void nodeStore.load(activeCanvasId);
    void edgeStore.load(activeCanvasId);
  });

  $effect(() => {
    const canvasId = activeCanvasId;
    const query = searchQuery.trim();
    const tag = activeTag;

    if (!canvasId || (!query && !tag)) {
      searchResults = [];
      searchLoading = false;
      searchError = null;
      return;
    }

    searchLoading = true;
    searchError = null;
    searchResults = [];

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      try {
        const url = new URL('/api/search', window.location.origin);
        url.searchParams.set('canvasId', canvasId);

        if (query) {
          url.searchParams.set('query', query);
        }

        if (tag) {
          url.searchParams.set('tag', tag);
        }

        const res = await fetch(url, { signal: controller.signal });

        if (!res.ok) {
          throw new Error(`Search request failed with ${res.status}`);
        }

        const data = (await res.json()) as Node[];
        searchResults = data;
      } catch (error) {
        if (controller.signal.aborted) {
          return;
        }

        searchResults = [];
        searchError = error instanceof Error ? error.message : 'Search failed';
      } finally {
        if (!controller.signal.aborted) {
          searchLoading = false;
        }
      }
    }, 160);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  });

  $effect(() => {
    if (!focusedNodeId) {
      return;
    }

    const filteredIds = searchHitIds;

    if (
      !searchLoading &&
      (searchQuery.trim() || activeTag) &&
      (!filteredIds.size || !filteredIds.has(focusedNodeId))
    ) {
      focusedNodeId = null;
    }
  });

  function addNode() {
    if (!activeCanvasId) return;

    // place near origin for now
    nodeStore.create(activeCanvasId, 100, 100);
  }

  function toggleTagFilter(tag: string) {
    const normalizedTag = normalizeTagName(tag);

    activeTag = activeTag === normalizedTag ? null : normalizedTag;
    focusedNodeId = null;
  }

  function clearDiscoveryFilters() {
    searchQuery = '';
    activeTag = null;
    focusedNodeId = null;
    searchResults = [];
    searchLoading = false;
    searchError = null;
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

  function focusSearchResult(nodeId: string) {
    focusedNodeId = nodeId;
  }

  function toggleDiscoveryPanel() {
    discoveryCollapsed = !discoveryCollapsed;
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

  <main class="workspace">
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
        onnodeclick={(event) => {
          focusedNodeId = event.node.id;
        }}
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

    <aside
      class="discovery-panel"
      class:discovery-panel--collapsed={discoveryCollapsed}
      aria-label="Search and filters"
    >
      <div class="discovery-panel__header">
        <div>
          <h3>{discoveryCollapsed ? 'F' : 'Find'}</h3>
          {#if !discoveryCollapsed}
            <p>Search titles, bodies, and tags without leaving the canvas.</p>
          {/if}
        </div>

        <div class="discovery-panel__actions">
          <button
            class="icon-button discovery-panel-toggle"
            type="button"
            aria-label={discoveryCollapsed ? 'Expand search panel' : 'Collapse search panel'}
            title={discoveryCollapsed ? 'Expand search panel' : 'Collapse search panel'}
            aria-expanded={!discoveryCollapsed}
            onclick={toggleDiscoveryPanel}
          >
            {#if discoveryCollapsed}
              <ChevronLeft size={14} aria-hidden="true" />
            {:else}
              <ChevronRight size={14} aria-hidden="true" />
            {/if}
          </button>
        </div>
      </div>

      {#if !discoveryCollapsed}
        <label class="discovery-search">
          <span>Keyword search</span>
          <div class="discovery-search-field">
            <input
              bind:value={searchQuery}
              class="sidebar-input discovery-search-input"
              placeholder="Search titles or body"
              aria-label="Search nodes by keyword"
            />
            <button
              class="icon-button discovery-search-clear"
              type="button"
              aria-label="Clear search and tag filters"
              title="Clear search and tag filters"
              onclick={clearDiscoveryFilters}
              disabled={!searchQuery.trim() && !activeTag}
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        </label>

        <section class="discovery-section">
          <div class="discovery-section__header">
            <h4>Tags</h4>
            <span>{tagSummaries.length} total</span>
          </div>

          {#if tagSummaries.length}
            <div class="tag-filter-list">
              {#each tagSummaries as tag}
                <button
                  type="button"
                  class="tag-filter-chip"
                  class:tag-filter-chip--active={activeTag === tag.name}
                  style={`--tag-color: ${tag.color};`}
                  onclick={() => toggleTagFilter(tag.name)}
                >
                  <span>{formatTagLabel(tag.name)}</span>
                  <span class="tag-filter-chip__count">{tag.count}</span>
                </button>
              {/each}
            </div>
          {:else}
            <p class="discovery-empty">No tags yet. Add tags to make them easy to find.</p>
          {/if}
        </section>

        <section class="discovery-section discovery-results">
          <div class="discovery-section__header">
            <h4>Matches</h4>
            <span>{activeFilterLabel}</span>
          </div>

          {#if searchLoading}
            <p class="discovery-empty">Searching...</p>
          {:else if searchError}
            <p class="discovery-error">{searchError}</p>
          {:else if !searchQuery.trim() && !activeTag}
            <p class="discovery-empty">Type a keyword or click a tag to see matches.</p>
          {:else if searchResults.length === 0}
            <p class="discovery-empty">No nodes match the current filters.</p>
          {:else}
            <div class="search-results">
              {#each searchResults as node}
                <button
                  type="button"
                  class="search-result"
                  class:search-result--focused={focusedNodeId === node.id}
                  onclick={() => focusSearchResult(node.id)}
                >
                  <span class="search-result__title">{node.title || 'Untitled'}</span>
                  {#if node.body}
                    <span class="search-result__body">
                      {node.body.length > 96 ? `${node.body.slice(0, 96).trim()}…` : node.body}
                    </span>
                  {/if}
                  {#if node.tags?.length}
                    <span class="search-result__tags">
                      {#each node.tags.slice(0, 4) as tag}
                        <span class="search-result__tag">{formatTagLabel(tag)}</span>
                      {/each}
                    </span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </section>
      {/if}
    </aside>
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

  .discovery-panel {
    width: 320px;
    min-width: 320px;
    border-left: var(--border-thin);
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.9), rgba(244, 246, 248, 0.95)),
      var(--surface-muted);
    padding: 1rem;
    display: flex;
    flex-direction: column;
    gap: 1rem;
    overflow: auto;
  }

  .discovery-panel--collapsed {
    width: 3.5rem;
    min-width: 3.5rem;
    padding: 0.75rem 0.35rem;
    align-items: center;
  }

  .discovery-panel__header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .discovery-panel--collapsed .discovery-panel__header {
    flex-direction: column;
    align-items: center;
    gap: 0.5rem;
  }

  .discovery-panel__header h3,
  .discovery-section__header h4 {
    margin: 0;
  }

  .discovery-panel__header h3 {
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .discovery-panel__header p {
    margin: 0.2rem 0 0;
    color: var(--text-muted);
    font-size: 0.88rem;
    line-height: 1.4;
  }

  .discovery-panel__actions {
    display: inline-flex;
    flex: 0 0 auto;
  }

  .discovery-search {
    display: grid;
    gap: 0.45rem;
  }

  .discovery-search > span {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .discovery-search-input {
    width: 100%;
  }

  .discovery-search-field {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .discovery-search-clear {
    flex: 0 0 auto;
  }

  .discovery-section {
    display: grid;
    gap: 0.75rem;
  }

  .discovery-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .discovery-section__header h4 {
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .discovery-section__header span {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .tag-filter-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  .tag-filter-chip {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border: 1px solid var(--tag-color);
    border-radius: 999px;
    padding: 0.35rem 0.65rem;
    background: color-mix(in srgb, var(--tag-color) 18%, white);
    color: var(--text-main);
    font-size: 0.8rem;
    line-height: 1;
    text-align: left;
  }

  .tag-filter-chip--active {
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--tag-color) 20%, transparent);
  }

  .tag-filter-chip__count {
    min-width: 1.5rem;
    padding: 0.1rem 0.35rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--tag-color) 30%, white);
    color: var(--text-main);
    font-size: 0.72rem;
    text-align: center;
  }

  .search-results {
    display: grid;
    gap: 0.5rem;
  }

  .search-result {
    display: grid;
    gap: 0.25rem;
    padding: 0.75rem;
    border: 1px solid var(--border-color);
    border-radius: 0.75rem;
    background: var(--surface);
    text-align: left;
    box-shadow: none;
  }

  .search-result--focused {
    border-color: var(--accent);
    box-shadow: var(--shadow-soft);
  }

  .search-result__title {
    font-weight: 600;
  }

  .search-result__body {
    color: var(--text-muted);
    font-size: 0.88rem;
    line-height: 1.35;
  }

  .search-result__tags {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    margin-top: 0.25rem;
  }

  .search-result__tag {
    border-radius: 999px;
    padding: 0.1rem 0.45rem;
    background: var(--surface-soft);
    color: var(--text-main);
    font-size: 0.72rem;
  }

  .discovery-empty,
  .discovery-error {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.4;
  }

  .discovery-empty {
    color: var(--text-muted);
  }

  .discovery-error {
    color: #b91c1c;
  }

  @media (max-width: 1180px) {
    .workspace {
      flex-direction: column;
    }

    .discovery-panel {
      width: auto;
      min-width: 0;
      border-left: 0;
      border-top: var(--border-thin);
      max-height: 40vh;
    }

    .discovery-panel--collapsed {
      width: auto;
      min-width: 0;
      max-height: none;
    }
  }
</style>
