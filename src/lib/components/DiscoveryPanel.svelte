<script lang="ts">
  import { Search, ChevronLeft, ChevronRight, X } from 'lucide-svelte';
  import type { DiscoveryNode, TagSummary } from '$lib/discovery';
  import { formatTagLabel } from '$lib/tagUtils';

  interface Props {
    searchQuery: string;
    activeTag: string | null;
    focusedNodeId: string | null;
    selectedNodeCount: number;
    selectedTagSummaries: TagSummary[];
    collapsed: boolean;
    tagSummaries: TagSummary[];
    searchResults: DiscoveryNode[];
    activeFilterLabel: string;
    onToggleTagFilter: (tag: string) => void;
    onClearFilters: () => void;
    onFocusSearchResult: (nodeId: string) => void;
    onAddSelectedTag: (tag: string) => void;
    onRemoveSelectedTag: (tag: string) => void;
    onClearSelection: () => void;
  }

  let {
    searchQuery = $bindable(''),
    activeTag,
    focusedNodeId,
    selectedNodeCount,
    selectedTagSummaries,
    collapsed = $bindable(false),
    tagSummaries,
    searchResults,
    activeFilterLabel,
    onToggleTagFilter,
    onClearFilters,
    onFocusSearchResult,
    onAddSelectedTag,
    onRemoveSelectedTag,
    onClearSelection
  }: Props = $props();

  let selectedTagInput = $state('');

  $effect(() => {
    if (!selectedNodeCount) {
      selectedTagInput = '';
    }
  });

  function handleAddSelectedTag() {
    const nextTag = selectedTagInput.trim();

    if (!nextTag) {
      return;
    }

    onAddSelectedTag(nextTag);
    selectedTagInput = '';
  }
</script>

<aside
  class="discovery-panel"
  class:discovery-panel--collapsed={collapsed}
  aria-label="Search and filters"
>
  <div class="discovery-panel__header">
    <div>
      <h3>
        {#if collapsed}
          <Search size={14} aria-hidden="true" />
        {:else}
          Find
        {/if}
      </h3>
      {#if !collapsed}
        <p>Search titles, bodies, and tags without leaving the canvas.</p>
      {/if}
    </div>

    <div class="discovery-panel__actions">
      <button
        class="icon-button discovery-panel-toggle"
        type="button"
        aria-label={collapsed ? 'Expand search panel' : 'Collapse search panel'}
        title={collapsed ? 'Expand search panel (F)' : 'Collapse search panel (F)'}
        aria-expanded={!collapsed}
        onclick={() => (collapsed = !collapsed)}
      >
        {#if collapsed}
          <ChevronLeft size={14} aria-hidden="true" />
        {:else}
          <ChevronRight size={14} aria-hidden="true" />
        {/if}
      </button>
    </div>
  </div>

  {#if !collapsed}
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
          onclick={onClearFilters}
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
              onclick={() => onToggleTagFilter(tag.name)}
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

    <section class="discovery-section">
      <div class="discovery-section__header">
        <h4>Selection</h4>
        <span>{selectedNodeCount} selected</span>
      </div>

      {#if selectedNodeCount}
        <label class="discovery-search">
          <span>Bulk tag</span>
          <div class="discovery-search-field">
            <input
              bind:value={selectedTagInput}
              class="sidebar-input discovery-search-input"
              placeholder="Add tag to selected nodes"
              aria-label="Add tag to selected nodes"
              onkeydown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault();
                  handleAddSelectedTag();
                }
              }}
            />
            <button
              class="button discovery-bulk-add"
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
          <p class="discovery-empty">Selected nodes have no tags yet.</p>
        {/if}

        <button class="button" type="button" onclick={onClearSelection}>
          Clear selection
        </button>
      {:else}
        <p class="discovery-empty">Select one or more nodes to add or remove tags in bulk.</p>
      {/if}
    </section>

    <section class="discovery-section discovery-results">
      <div class="discovery-section__header">
        <h4>Matches</h4>
        <span>{activeFilterLabel}</span>
      </div>

      {#if !searchQuery.trim() && !activeTag}
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
    </section>
  {/if}
</aside>

<style>
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

  .discovery-panel--collapsed .discovery-panel__header h3 {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    letter-spacing: 0;
    text-transform: none;
    line-height: 1;
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

  .discovery-empty {
    margin: 0;
    font-size: 0.9rem;
    line-height: 1.4;
    color: var(--text-muted);
  }

  @media (max-width: 1180px) {
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
