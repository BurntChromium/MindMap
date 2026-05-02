<script lang="ts">
  import { Search, ChevronLeft, ChevronRight, X } from 'lucide-svelte';
  import type { DiscoveryNode, TagSummary } from '$lib/discovery';
  import { formatTagLabel } from '$lib/tagUtils';
  import type { EntityInspectorEntry } from '$lib/entityInspector';

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
    activeTab: PanelTab;
    activeEntityId: string | null;
    onToggleTagFilter: (tag: string) => void;
    onClearFilters: () => void;
    onFocusSearchResult: (nodeId: string) => void;
    onFocusEntityNode: (nodeId: string) => void;
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
    activeTab = $bindable<PanelTab>('search'),
    activeEntityId = $bindable<string | null>(null),
    onToggleTagFilter,
    onClearFilters,
    onFocusSearchResult,
    onFocusEntityNode,
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
</script>

<aside
  class="inspector-panel"
  class:inspector-panel--collapsed={collapsed}
  aria-label="Search, tags, and entities"
>
  <div class="inspector-panel__header">
    <button
      class="icon-button inspector-panel-toggle"
      type="button"
      aria-label={collapsed ? 'Expand inspector panel' : 'Collapse inspector panel'}
      title={collapsed ? 'Expand inspector panel (F)' : 'Collapse inspector panel (F)'}
      aria-expanded={!collapsed}
      onclick={() => (collapsed = !collapsed)}
    >
      {#if collapsed}
        <ChevronLeft size={14} aria-hidden="true" />
      {:else}
        <ChevronRight size={14} aria-hidden="true" />
      {/if}
    </button>
    <div class="inspector-panel__header-actions">
      {#if !collapsed}
        <div class="panel-tabs" role="tablist" aria-label="Right panel tabs">
          <button
            class="panel-tab"
            class:panel-tab--active={activeTab === 'search'}
            type="button"
            role="tab"
            aria-selected={activeTab === 'search'}
            onclick={() => (activeTab = 'search')}
          >
            Search
          </button>
          <button
            class="panel-tab"
            class:panel-tab--active={activeTab === 'tags'}
            type="button"
            role="tab"
            aria-selected={activeTab === 'tags'}
            onclick={() => (activeTab = 'tags')}
          >
            Tags
          </button>
          <button
            class="panel-tab"
            class:panel-tab--active={activeTab === 'entities'}
            type="button"
            role="tab"
            aria-selected={activeTab === 'entities'}
            onclick={() => (activeTab = 'entities')}
          >
            Entities
          </button>
        </div>
      {/if}
    </div>
  </div>

  {#if !collapsed}
    <div class="panel-tabpanels">
      {#if activeTab === 'search'}
        <div class="panel-section" role="tabpanel" aria-label="Search">
          <label class="panel-search">
            <span>Keyword search</span>
            <div class="panel-search-field">
              <input
                bind:value={searchQuery}
                class="sidebar-input panel-search-input"
                placeholder="Search titles or body"
                aria-label="Search nodes by keyword"
              />
              <button
                class="icon-button panel-search-clear"
                type="button"
                aria-label="Clear search and tag filters"
                title="Clear search and tag filters"
                onclick={onClearFilters}
                disabled={!searchQuery.trim() && !activeTag}
              >
                <X size={14} aria-hidden="true" />
              </button>
            </div>
          </label>

          <div class="panel-section__header">
            <h4>Matches</h4>
            <span>{activeFilterLabel}</span>
          </div>

          {#if !searchQuery.trim() && !activeTag}
            <p class="panel-empty">Type a keyword or click a tag to see matches.</p>
          {:else if searchResults.length === 0}
            <p class="panel-empty">No nodes match the current filters.</p>
          {:else}
            <div class="search-results">
              {#each searchResults as node}
                <button
                  type="button"
                  class="search-result"
                  class:search-result--focused={focusedNodeId === node.id}
                  onclick={() => onFocusSearchResult(node.id)}
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
        </div>
      {/if}

      {#if activeTab === 'tags'}
        <div class="panel-section" role="tabpanel" aria-label="Tags">
          <div class="panel-section__header">
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
                  onclick={() => onToggleTagFilter(tag.name)}
                >
                  <span>{formatTagLabel(tag.name)}</span>
                  <span class="tag-filter-chip__count">{tag.count}</span>
                </button>
              {/each}
            </div>
          {:else}
            <p class="panel-empty">No tags yet. Add tags to make them easy to find.</p>
          {/if}

          <div class="panel-section__header panel-section__header--spaced">
            <h4>Bulk edit</h4>
            <span>{selectedNodeCount} selected</span>
          </div>

          {#if selectedNodeCount}
            <label class="panel-search">
              <span>Add tag to selection</span>
              <div class="panel-search-field">
                <input
                  bind:this={selectedTagInputRef}
                  bind:value={selectedTagInput}
                  class="sidebar-input panel-search-input"
                  placeholder="Add tag to selected nodes"
                  aria-label="Add tag to selected nodes"
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
                  class="button panel-bulk-add"
                  type="button"
                  onclick={handleAddSelectedTag}
                  disabled={!selectedTagInput.trim()}
                >
                  Add
                </button>
              </div>
            </label>

            {#if selectedTagSummaries.length}
              <div class="tag-filter-list">
                {#each selectedTagSummaries as tag}
                  <button
                    type="button"
                    class="tag-filter-chip tag-filter-chip--selected"
                    style={`--tag-color: ${tag.color};`}
                    onclick={() => onRemoveSelectedTag(tag.name)}
                    title={`Remove ${formatTagLabel(tag.name)} from selected nodes`}
                  >
                    <span>{formatTagLabel(tag.name)}</span>
                    <span class="tag-filter-chip__count">{tag.count}</span>
                    <X size={12} aria-hidden="true" />
                  </button>
                {/each}
              </div>
            {:else}
              <p class="panel-empty">Selected nodes have no tags yet.</p>
            {/if}
          {:else}
            <p class="panel-empty">Select one or more nodes to edit their tags in bulk.</p>
          {/if}
        </div>
      {/if}

      {#if activeTab === 'entities'}
        <div class="panel-section" role="tabpanel" aria-label="Entities">
          <div class="panel-section__header">
            <h4>Entities</h4>
            <span>{entityEntries.length} total</span>
          </div>

          {#if entityEntries.length}
            <div class="entity-list">
              {#each entityEntries as entity}
                <article class="entity-card" class:entity-card--active={activeEntityId === entity.id}>
                  <button
                    type="button"
                    class="entity-card__summary"
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
                            <button class="button entity-card__jump" type="button" onclick={() => onFocusEntityNode(primaryNode.id)}>
                              Open
                            </button>
                          </div>
                          <button
                            type="button"
                            class="entity-node"
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
                            <p class="panel-empty">No other nodes mention this entity yet.</p>
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
                            <p class="panel-empty">No nodes mention this entity yet.</p>
                          {/if}
                        </div>
                      {/if}
                    </div>
                  {/if}
                </article>
              {/each}
            </div>
          {:else}
            <p class="panel-empty">No entities yet. Add `[[Entity]]` mentions to populate this list.</p>
          {/if}
        </div>
      {/if}
    </div>

    <section class="panel-footer">
      <div class="panel-section__header panel-section__header--spaced">
        <h4>Selection</h4>
        <span>{selectedNodeCount} selected</span>
      </div>

      {#if selectedNodeCount}
        <div class="panel-selection-actions">
          <button class="button" type="button" onclick={onClearSelection}>Clear selection</button>
          <button class="button" type="button" onclick={onDuplicateSelection}>Duplicate</button>
          <button class="button" type="button" onclick={onDuplicateSubtree}>Duplicate subtree</button>
        </div>
      {:else}
        <p class="panel-empty">Select one or more nodes to duplicate or clear them.</p>
      {/if}
    </section>
  {/if}
</aside>

<style>
  .inspector-panel {
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

  .inspector-panel--collapsed {
    width: 3.5rem;
    min-width: 3.5rem;
    padding: 0.75rem 0.35rem;
    align-items: center;
  }

  .inspector-panel__header {
    display: flex;
    align-items: start;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .inspector-panel__title {
    min-width: 0;
  }

  .inspector-panel__title h3,
  .panel-section__header h4,
  .entity-card__section h5 {
    margin: 0;
  }

  .inspector-panel__title h3 {
    font-size: 0.8rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
    display: inline-flex;
    align-items: center;
    gap: 0.35rem;
  }

  .inspector-panel--collapsed .inspector-panel__title h3 {
    letter-spacing: 0;
    text-transform: none;
    line-height: 1;
  }

  .inspector-panel__header-actions {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 0 0 auto;
  }

  .panel-tabs {
    display: inline-flex;
    flex-wrap: wrap;
    gap: 0.35rem;
    padding: 0.2rem;
    border-radius: 999px;
    background: color-mix(in srgb, var(--surface) 70%, transparent);
    border: var(--border-thin);
  }

  .panel-tab {
    border: 0;
    border-radius: 999px;
    padding: 0.3rem 0.65rem;
    font-size: 0.78rem;
    color: var(--text-muted);
    background: transparent;
  }

  .panel-tab--active {
    background: var(--surface);
    color: var(--text-main);
    box-shadow: var(--shadow-soft);
  }

  .panel-tabpanels,
  .panel-footer {
    display: grid;
    gap: 0.9rem;
  }

  .panel-section {
    display: grid;
    gap: 0.8rem;
  }

  .panel-section__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 0.75rem;
  }

  .panel-section__header--spaced {
    padding-top: 0.6rem;
    border-top: var(--border-thin);
  }

  .panel-section__header h4 {
    font-size: 0.74rem;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--text-muted);
  }

  .panel-section__header span {
    font-size: 0.8rem;
    color: var(--text-muted);
  }

  .panel-search {
    display: grid;
    gap: 0.45rem;
  }

  .panel-search > span {
    font-size: 0.72rem;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    color: var(--text-muted);
  }

  .panel-search-field {
    display: flex;
    align-items: center;
    gap: 0.4rem;
  }

  .panel-search-input {
    width: 100%;
  }

  .panel-search-clear,
  .panel-bulk-add {
    flex: 0 0 auto;
  }

  .panel-empty {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.4;
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

  .tag-filter-chip--selected {
    align-items: center;
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

  .panel-selection-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.5rem;
  }

  @media (max-width: 1180px) {
    .inspector-panel {
      width: auto;
      min-width: 0;
      border-left: 0;
      border-top: var(--border-thin);
      max-height: 40vh;
    }

    .inspector-panel--collapsed {
      width: auto;
      min-width: 0;
      max-height: none;
    }
  }
</style>
