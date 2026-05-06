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
    focusBulkTagInputSignal: number;
    tagSummaries: TagSummary[];
    searchResults: DiscoveryNode[];
    activeFilterLabel: string;
    onToggleTagFilter: (tag: string) => void;
    onClearFilters: () => void;
    onFocusSearchResult: (nodeId: string) => void;
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
    onToggleTagFilter,
    onClearFilters,
    onFocusSearchResult,
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
</script>

<aside
  class="panel-shell panel-shell--right"
  class:panel-shell--collapsed={collapsed}
  aria-label="Search and filters"
>
  <div class="panel-shell__header">
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

    <div class="panel-shell__header-actions">
      <button
        class="icon-button"
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
    <label class="panel-shell__search">
      <span>Keyword search</span>
      <div class="panel-shell__search-field">
        <input
          bind:value={searchQuery}
          class="sidebar-input panel-shell__search-input"
          placeholder="Search titles or body"
          aria-label="Search nodes by keyword"
        />
        <button
          class="icon-button"
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

    <section class="panel-shell__section">
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
    </section>

    <section class="panel-shell__section">
      <div class="panel-shell__section-header">
        <h4>Selection</h4>
        <span>{selectedNodeCount} selected</span>
      </div>

      {#if selectedNodeCount}
        <label class="panel-shell__search">
          <span>Bulk tag</span>
          <div class="panel-shell__search-field">
            <input
              bind:this={selectedTagInputRef}
              bind:value={selectedTagInput}
              class="sidebar-input panel-shell__search-input"
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
            <button class="button" type="button" onclick={handleAddSelectedTag} disabled={!selectedTagInput.trim()}>
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

        <button class="button" type="button" onclick={onClearSelection}>
          Clear selection
        </button>
        <div class="panel-shell__actions-row">
          <button class="button" type="button" onclick={onDuplicateSelection}>
            Duplicate
          </button>
          <button class="button" type="button" onclick={onDuplicateSubtree}>
            Duplicate subtree
          </button>
        </div>
      {:else}
        <p class="panel-shell__empty">Select one or more nodes to add or remove tags in bulk.</p>
      {/if}
    </section>

    <section class="panel-shell__section">
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
    </section>
  {/if}
</aside>
