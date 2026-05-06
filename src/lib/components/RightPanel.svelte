<script lang="ts">
  import { Search, ChevronLeft, ChevronRight, X } from 'lucide-svelte';
  import type { DiscoveryNode, TagSummary } from '$lib/discovery';
  import { formatTagLabel } from '$lib/tagUtils';
  import type { EntityInspectorEntry } from '$lib/entityInspector';
  import type { AssociativeFlowEdge } from '$lib/graph/associativeEdges';

  type PanelTab = 'search' | 'tags' | 'entities';

  interface Props {
    searchQuery: string;
    activeTag: string | null;
    focusedNodeId: string | null;
    selectedNodeCount: number;
    selectedTagSummaries: TagSummary[];
    collapsed: boolean;
    focusBulkTagInputSignal: number;
    tagSummaries: TagSummary[];
    searchResults: DiscoveryNode[];
    activeFilterLabel: string;
    entityEntries: EntityInspectorEntry[];
    activeAssociativeEdge: AssociativeFlowEdge | null;
    activeTab: PanelTab;
    activeEntityId: string | null;
    onToggleTagFilter: (tag: string) => void;
    onClearFilters: () => void;
    onFocusSearchResult: (nodeId: string) => void;
    onFocusEntityNode: (nodeId: string) => void;
    onFocusEntityTitle: (title: string) => void;
    onClearAssociativeEdge: () => void;
    onAddSelectedTag: (tag: string) => void;
    onRemoveSelectedTag: (tag: string) => void;
    onDuplicateSelection: () => void;
    onDuplicateSubtree: () => void;
    onClearSelection: () => void;
    onExitBulkTagInput: () => void;
  }

  let {
    searchQuery = $bindable(''),
    activeTag,
    focusedNodeId,
    selectedNodeCount,
    selectedTagSummaries,
    collapsed = $bindable(false),
    focusBulkTagInputSignal,
    tagSummaries,
    searchResults,
    activeFilterLabel,
    entityEntries,
    activeAssociativeEdge,
    activeTab = $bindable<PanelTab>('search'),
    activeEntityId = $bindable<string | null>(null),
    onToggleTagFilter,
    onClearFilters,
    onFocusSearchResult,
    onFocusEntityNode,
    onFocusEntityTitle,
    onClearAssociativeEdge,
    onAddSelectedTag,
    onRemoveSelectedTag,
    onDuplicateSelection,
    onDuplicateSubtree,
    onClearSelection,
    onExitBulkTagInput
  }: Props = $props();

  let selectedTagInput = $state('');
  let selectedTagInputRef = $state<HTMLInputElement | undefined>(undefined);
  let lastFocusBulkTagInputSignal = $state(0);

  $effect(() => {
    if (!selectedNodeCount) {
      selectedTagInput = '';
    }
  });

  $effect(() => {
    if (!selectedNodeCount) {
      return;
    }

    if (focusBulkTagInputSignal === lastFocusBulkTagInputSignal) {
      return;
    }

    lastFocusBulkTagInputSignal = focusBulkTagInputSignal;
    activeTab = 'tags';
    collapsed = false;

    queueMicrotask(() => {
      selectedTagInputRef?.focus();
      selectedTagInputRef?.select();
    });
  });

  function handleAddSelectedTag() {
    const nextTag = selectedTagInput.trim();

    if (!nextTag) {
      return;
    }

    onAddSelectedTag(nextTag);
    selectedTagInput = '';
  }

  function toggleEntitySelection(entityId: string) {
    activeEntityId = activeEntityId === entityId ? null : entityId;
  }

  function getEntitySummary(entry: EntityInspectorEntry) {
    if (entry.primaryNode && entry.sourceNodeCount === 0) {
      return 'Canonical node';
    }

    const noun = entry.sourceNodeCount === 1 ? 'node' : 'nodes';
    return `${entry.mentionCount} mentions across ${entry.sourceNodeCount} ${noun}`;
  }

  function getAssociativeEdgeSummary(edge: AssociativeFlowEdge) {
    const sharedCount = edge.data.sharedEntities.length;
    const noun = sharedCount === 1 ? 'entity' : 'entities';

    return `${sharedCount} shared ${noun}`;
  }
</script>

<aside
  class="panel-shell panel-shell--right"
  class:panel-shell--collapsed={collapsed}
  aria-label="Search, tags, and entities"
>
  <div class="panel-shell__header">
    <button
      class="icon-button"
      type="button"
      aria-label={collapsed ? 'Expand inspector panel' : 'Collapse inspector panel'}
      title={collapsed ? 'Expand inspector panel (F)' : 'Collapse inspector panel (F)'}
      aria-expanded={!collapsed}
      data-testid="inspector-toggle"
      onclick={() => (collapsed = !collapsed)}
    >
      {#if collapsed}
        <ChevronLeft size={14} aria-hidden="true" />
      {:else}
        <ChevronRight size={14} aria-hidden="true" />
      {/if}
    </button>
    <div class="panel-shell__header-actions">
      {#if !collapsed}
        <div class="panel-shell__tablist" role="tablist" aria-label="Right panel tabs">
          <button
            class="panel-shell__tab"
            class:panel-shell__tab--active={activeTab === 'search'}
            type="button"
            role="tab"
            aria-selected={activeTab === 'search'}
            data-testid="panel-tab-search"
            onclick={() => (activeTab = 'search')}
          >
            Search
          </button>
          <button
            class="panel-shell__tab"
            class:panel-shell__tab--active={activeTab === 'tags'}
            type="button"
            role="tab"
            aria-selected={activeTab === 'tags'}
            data-testid="panel-tab-tags"
            onclick={() => (activeTab = 'tags')}
          >
            Tags
          </button>
          <button
            class="panel-shell__tab"
            class:panel-shell__tab--active={activeTab === 'entities'}
            type="button"
            role="tab"
            aria-selected={activeTab === 'entities'}
            data-testid="panel-tab-entities"
            onclick={() => (activeTab = 'entities')}
          >
            Entities
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if !collapsed}
    <div class="panel-shell__content">
      {#if activeTab === 'search'}
        <div class="panel-shell__section" role="tabpanel" aria-label="Search">
          <label class="panel-shell__search">
            <span>Keyword search</span>
            <div class="panel-shell__search-field">
              <input
                bind:value={searchQuery}
                class="sidebar-input panel-shell__search-input"
                placeholder="Search titles or body"
                aria-label="Search nodes by keyword"
                data-testid="panel-search-input"
              />
              <button
                class="icon-button"
                type="button"
                aria-label="Clear search and tag filters"
                title="Clear search and tag filters"
                data-testid="panel-search-clear"
                onclick={onClearFilters}
                disabled={!searchQuery.trim() && !activeTag}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </label>

          <div class="panel-shell__section-header">
            <h4>Matches</h4>
            <span>{activeFilterLabel}</span>
          </div>

          {#if !searchQuery.trim() && !activeTag}
            <p class="panel-shell__empty">Type a keyword or click a tag to see matches.</p>
          {:else if searchResults.length === 0}
            <p class="panel-shell__empty">No nodes match the current filters.</p>
          {:else}
            <div class="panel-shell__result-list">
              {#each searchResults as node}
                <button
                  type="button"
                  class="panel-shell__result"
                  class:panel-shell__result--focused={focusedNodeId === node.id}
                  data-testid={`search-result-${node.id}`}
                  onclick={() => onFocusSearchResult(node.id)}
                >
                  <span class="panel-shell__result-title">{node.title || 'Untitled'}</span>
                  {#if node.body}
                    <span class="panel-shell__result-body">
                      {node.body.length > 96 ? `${node.body.slice(0, 96).trim()}…` : node.body}
                    </span>
                  {/if}
                  {#if node.tags?.length}
                    <span class="panel-shell__result-tags">
                      {#each node.tags.slice(0, 4) as tag}
                        <span class="panel-shell__result-tag">{formatTagLabel(tag)}</span>
                      {/each}
                    </span>
                  {/if}
                </button>
              {/each}
            </div>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'tags'}
        <div class="panel-shell__section" role="tabpanel" aria-label="Tags">
          <div class="panel-shell__section-header">
            <h4>Tags</h4>
            <span>{tagSummaries.length} total</span>
          </div>

          {#if tagSummaries.length}
            <div class="panel-shell__chip-list">
              {#each tagSummaries as tag}
                <button
                  type="button"
                  class="panel-shell__chip"
                  class:panel-shell__chip--active={activeTag === tag.name}
                  style={`--tag-color: ${tag.color};`}
                  data-testid={`tag-filter-${tag.name}`}
                  onclick={() => onToggleTagFilter(tag.name)}
                >
                  <span>{formatTagLabel(tag.name)}</span>
                  <span class="panel-shell__chip-count">{tag.count}</span>
                </button>
              {/each}
            </div>
          {:else}
            <p class="panel-shell__empty">No tags yet. Add tags to make them easy to find.</p>
          {/if}

          <div class="panel-shell__section-header panel-shell__section-header--spaced">
            <h4>Bulk edit</h4>
            <span>{selectedNodeCount} selected</span>
          </div>

          {#if selectedNodeCount}
            <label class="panel-shell__search">
              <span>Add tag to selection</span>
              <div class="panel-shell__search-field">
                <input
                  bind:this={selectedTagInputRef}
                  bind:value={selectedTagInput}
                  class="sidebar-input panel-shell__search-input"
                  placeholder="Add tag to selected nodes"
                  aria-label="Add tag to selected nodes"
                  data-testid="bulk-tag-input"
                  onkeydown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      handleAddSelectedTag();
                      return;
                    }

                    if (event.key === 'Escape') {
                      event.preventDefault();
                      onExitBulkTagInput();
                    }
                  }}
                />
                <button
                  class="button"
                  type="button"
                  data-testid="bulk-tag-add"
                  onclick={handleAddSelectedTag}
                  disabled={!selectedTagInput.trim()}
                >
                  Add
                </button>
              </div>
            </label>

            {#if selectedTagSummaries.length}
              <div class="panel-shell__chip-list">
                {#each selectedTagSummaries as tag}
                  <button
                    type="button"
                    class="panel-shell__chip panel-shell__chip--selected"
                    style={`--tag-color: ${tag.color};`}
                    data-testid={`selected-tag-${tag.name}`}
                    onclick={() => onRemoveSelectedTag(tag.name)}
                    title={`Remove ${formatTagLabel(tag.name)} from selected nodes`}
                  >
                    <span>{formatTagLabel(tag.name)}</span>
                    <span class="panel-shell__chip-count">{tag.count}</span>
                    <X size={12} aria-hidden="true" />
                  </button>
                {/each}
              </div>
            {:else}
              <p class="panel-shell__empty">Selected nodes have no tags yet.</p>
            {/if}
          {:else}
            <p class="panel-shell__empty">Select one or more nodes to edit their tags in bulk.</p>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'entities'}
        <div class="panel-shell__section" role="tabpanel" aria-label="Entities">
          <div class="panel-shell__section-header">
            <h4>Entities</h4>
            <span>{entityEntries.length} total</span>
          </div>

          {#if activeAssociativeEdge}
            <article class="entity-edge-card">
              <div class="entity-card__section-header">
                <h5>Associative edge</h5>
                <button
                  class="icon-button entity-edge-card__clear"
                  type="button"
                  aria-label="Clear associative edge inspection"
                  title="Clear associative edge inspection"
                  data-testid="associative-edge-clear"
                  onclick={onClearAssociativeEdge}
                >
                  <X size={12} aria-hidden="true" />
                </button>
              </div>

              <div class="entity-edge-card__summary">
                <span class="entity-edge-card__title">
                  {activeAssociativeEdge.data.sourceNodeTitle || activeAssociativeEdge.data.sourceNodeId}
                  →
                  {activeAssociativeEdge.data.targetNodeTitle || activeAssociativeEdge.data.targetNodeId}
                </span>
                <span class="entity-edge-card__meta">
                  {getAssociativeEdgeSummary(activeAssociativeEdge)}
                </span>
              </div>

              <div class="entity-card__section">
                <h5>Endpoint nodes</h5>
                <div class="entity-node-list">
                  <button
                    type="button"
                    class="entity-node"
                    data-testid="associative-edge-source-node"
                    onclick={() => onFocusEntityNode(activeAssociativeEdge.data.sourceNodeId)}
                  >
                    <span class="entity-node__title">
                      {activeAssociativeEdge.data.sourceNodeTitle || activeAssociativeEdge.data.sourceNodeId}
                    </span>
                    <span class="entity-node__meta">Source</span>
                  </button>
                  <button
                    type="button"
                    class="entity-node"
                    data-testid="associative-edge-target-node"
                    onclick={() => onFocusEntityNode(activeAssociativeEdge.data.targetNodeId)}
                  >
                    <span class="entity-node__title">
                      {activeAssociativeEdge.data.targetNodeTitle || activeAssociativeEdge.data.targetNodeId}
                    </span>
                    <span class="entity-node__meta">Target</span>
                  </button>
                </div>
              </div>

              <div class="entity-card__section">
                <h5>Shared entities</h5>
                <div class="entity-edge-chip-list">
                  {#each activeAssociativeEdge.data.sharedEntities as entity}
                    <button
                      type="button"
                      class="entity-edge-chip"
                      data-testid={`associative-edge-entity-${entity.title}`}
                      onclick={() => onFocusEntityTitle(entity.title)}
                    >
                      <span>{entity.title}</span>
                    </button>
                  {/each}
                </div>
              </div>
            </article>
          {/if}

          {#if entityEntries.length}
            <div class="entity-list">
              {#each entityEntries as entity}
                <article class="entity-card" class:entity-card--active={activeEntityId === entity.id}>
                  <button
                    type="button"
                    class="entity-card__summary"
                    data-testid={`entity-summary-${entity.id}`}
                    onclick={() => toggleEntitySelection(entity.id)}
                  >
                    <div class="entity-card__title-row">
                      <span class="entity-card__title">{entity.title}</span>
                      <span class="entity-card__count">{entity.mentionCount}</span>
                    </div>
                    <span class="entity-card__meta">{getEntitySummary(entity)}</span>
                  </button>

                  {#if activeEntityId === entity.id}
                    <div class="entity-card__detail">
                      {#if entity.primaryNode}
                        {@const primaryNode = entity.primaryNode}
                        <div class="entity-card__section">
                          <div class="entity-card__section-header">
                            <h5>Primary node</h5>
                            <button
                              class="button entity-card__jump"
                              type="button"
                              data-testid={`entity-open-${entity.id}`}
                              onclick={() => onFocusEntityNode(primaryNode.id)}
                            >
                              Open
                            </button>
                          </div>
                          <button
                            type="button"
                            class="entity-node"
                            data-testid={`entity-primary-node-${entity.id}`}
                            onclick={() => onFocusEntityNode(primaryNode.id)}
                          >
                            <span class="entity-node__title">{primaryNode.title}</span>
                            <span class="entity-node__meta">
                              {primaryNode.mentionCount} mentions
                            </span>
                          </button>
                        </div>

                        <div class="entity-card__section">
                          <h5>Other referents</h5>
                          {#if entity.childNodes.length}
                            <div class="entity-node-list">
                              {#each entity.childNodes as node}
                                <button
                                  type="button"
                                  class="entity-node"
                                  data-testid={`entity-child-node-${node.id}`}
                                  onclick={() => onFocusEntityNode(node.id)}
                                >
                                  <span class="entity-node__title">{node.title}</span>
                                  <span class="entity-node__meta">
                                    {node.mentionCount} mentions
                                    {#if node.firstReferenceText}
                                      · {node.firstReferenceText}
                                    {/if}
                                  </span>
                                </button>
                              {/each}
                            </div>
                          {:else}
                            <p class="panel-shell__empty">No other nodes mention this entity yet.</p>
                          {/if}
                        </div>
                      {:else}
                        <div class="entity-card__section">
                          <h5>Referencing nodes</h5>
                          {#if entity.flatNodes.length}
                            <div class="entity-node-list">
                              {#each entity.flatNodes as node}
                                <button
                                  type="button"
                                  class="entity-node"
                                  data-testid={`entity-referencing-node-${node.id}`}
                                  onclick={() => onFocusEntityNode(node.id)}
                                >
                                  <span class="entity-node__title">{node.title}</span>
                                  <span class="entity-node__meta">
                                    {node.mentionCount} mentions
                                    {#if node.firstReferenceText}
                                      · {node.firstReferenceText}
                                    {/if}
                                  </span>
                                </button>
                              {/each}
                            </div>
                          {:else}
                            <p class="panel-shell__empty">No nodes mention this entity yet.</p>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          {:else}
            <p class="panel-shell__empty">No entities yet. Add `[[Entity]]` mentions to populate this list.</p>
          {/if}
        </div>
      {/if}
    </div>

    <section class="panel-shell__footer">
      <div class="panel-shell__section-header panel-shell__section-header--spaced">
        <h4>Selection</h4>
        <span>{selectedNodeCount} selected</span>
      </div>

      {#if selectedNodeCount}
        <div class="panel-shell__actions-row">
          <button class="button" type="button" onclick={onClearSelection}>Clear selection</button>
          <button class="button" type="button" onclick={onDuplicateSelection}>Duplicate</button>
          <button class="button" type="button" onclick={onDuplicateSubtree}>Duplicate subtree</button>
        </div>
      {:else}
        <p class="panel-shell__empty">Select one or more nodes to duplicate or clear them.</p>
      {/if}
    </section>
  {/if}
</aside>

<style>
  .entity-list {
    display: grid;
    gap: 0.5rem;
  }

  .entity-card {
    border: 1px solid var(--border-color);
    border-radius: 0.85rem;
    background: var(--surface);
    overflow: clip;
  }

  .entity-card--active {
    border-color: var(--accent);
    box-shadow: var(--shadow-soft);
  }

  .entity-card__summary {
    width: 100%;
    display: grid;
    gap: 0.2rem;
    padding: 0.75rem;
    text-align: left;
    background: transparent;
    border: 0;
  }

  .entity-card__title-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .entity-card__title {
    font-weight: 600;
  }

  .entity-card__count {
    min-width: 1.6rem;
    padding: 0.12rem 0.4rem;
    border-radius: 999px;
    background: var(--surface-soft);
    color: var(--text-main);
    font-size: 0.72rem;
    text-align: center;
  }

  .entity-card__meta {
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  .entity-card__detail {
    padding: 0 0.75rem 0.75rem;
    display: grid;
    gap: 0.75rem;
  }

  .entity-edge-card {
    border: 1px solid var(--border-color);
    border-radius: 0.85rem;
    background: color-mix(in srgb, var(--surface) 82%, var(--accent) 4%);
    padding: 0.75rem;
    display: grid;
    gap: 0.7rem;
  }

  .entity-edge-card__clear {
    margin-left: auto;
  }

  .entity-edge-card__summary {
    display: grid;
    gap: 0.2rem;
  }

  .entity-edge-card__title {
    font-weight: 600;
  }

  .entity-edge-card__meta {
    color: var(--text-muted);
    font-size: 0.82rem;
  }

  .entity-card__section {
    display: grid;
    gap: 0.5rem;
  }

  .entity-card__section-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .entity-card__section h5 {
    margin: 0;
    font-size: 0.72rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .entity-node-list {
    display: grid;
    gap: 0.35rem;
  }

  .entity-node {
    display: grid;
    gap: 0.2rem;
    padding: 0.65rem 0.7rem;
    border-radius: 0.7rem;
    border: 1px solid var(--border-color);
    background: var(--surface-soft);
    text-align: left;
  }

  .entity-node__title {
    font-weight: 600;
  }

  .entity-node__meta {
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.35;
  }

  .entity-edge-chip-list {
    display: flex;
    flex-wrap: wrap;
    gap: 0.35rem;
  }

  .entity-edge-chip {
    border: 1px solid var(--border-color);
    border-radius: 999px;
    padding: 0.35rem 0.65rem;
    background: var(--surface);
    color: var(--text-main);
    font-size: 0.8rem;
    line-height: 1;
    text-align: left;
  }

</style>
