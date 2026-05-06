<script lang="ts">
  import { get } from 'svelte/store';
  import { Handle, Position } from '@xyflow/svelte';
  import { Check, ChevronDown, ChevronUp, Pencil } from 'lucide-svelte';
  import { nodeStore } from '$lib/stores/nodeStore';
  import {
    getNodeMode,
    nodeUiStore,
    type NodeMode,
    type NodeUiState
  } from '$lib/stores/nodeUiStore';
  import {
    formatTagLabel,
    normalizeTagList,
    normalizeTagName
  } from '$lib/tagUtils';
  import { hasNodeTitleConflict, normalizeNodeTitle } from '$lib/nodeTitles';
  import { parseInlineContent } from '$lib/inlineContent';
  import { isSaveAndExitEditShortcut } from '$lib/shortcutUtils';
  import { getTagColor, getTagColorWithAlpha, rgbaFromHex } from '$lib/tagColors';

  let { id, data, selected } = $props();

  let nodeMode = $state<NodeMode>('compact');
  let titleInput = $state<HTMLInputElement | undefined>(undefined);
  let tagInput = $state<HTMLInputElement | undefined>(undefined);
  let bodyInput = $state<HTMLTextAreaElement | undefined>(undefined);
  let draftTitle = $state('');
  let draftBody = $state('');
  let draftTags = $state<string[]>([]);
  let draftTagInput = $state('');
  let draftIsEntity = $state(true);
  let titleError = $state<string | null>(null);

  const isEditing = $derived(nodeMode === 'edit');
  const isExpanded = $derived(nodeMode !== 'compact');
  const bodyText = $derived(data.body ?? '');
  const isEntityPage = $derived(Boolean(data.is_entity ?? 0));
  const onEntityClick = $derived(data.onEntityClick ?? null);
  const nodeTags = $derived(Array.isArray(data.tags) ? data.tags : []);
  const isSearchHit = $derived(Boolean(data.isSearchHit));
  const activeTagName = $derived(normalizeTagName(data.activeTag ?? ''));
  const activeTagColor = $derived(data.activeTagColor ?? null);
  const onTagClick = $derived(data.onTagClick ?? null);
  const highlightHex = $derived(activeTagColor ?? getTagColor(activeTagName));
  const isTagHighlighted = $derived(
    Boolean(activeTagName) && nodeTags.includes(activeTagName)
  );
  const overlayColor = $derived(
    isTagHighlighted ? rgbaFromHex(highlightHex, 0.22) : 'transparent'
  );
  const bodySegments = $derived(parseInlineContent(bodyText));

  $effect(() => {
    const unsub = nodeUiStore.subscribe((v: NodeUiState) => {
      nodeMode = getNodeMode(v, id);
    });

    return unsub;
  });

  $effect(() => {
    if (!isEditing) {
      draftTitle = data.label || 'Untitled';
      draftBody = bodyText;
      draftTags = normalizeTagList(nodeTags);
      draftTagInput = '';
      draftIsEntity = isEntityPage;
      titleError = null;
    }
  });

  async function beginEdit() {
    draftTitle = data.label || 'Untitled';
    draftBody = bodyText;
    draftTags = normalizeTagList(nodeTags);
    draftTagInput = '';
    draftIsEntity = isEntityPage;
    titleError = null;
    nodeUiStore.beginEdit(id);
  }

  function focusEditField(target: 'title' | 'tag' | 'body') {
    if (target === 'title') {
      titleInput?.focus();
      titleInput?.select();
      return;
    }

    if (target === 'tag') {
      tagInput?.focus();
      tagInput?.select();
      return;
    }

    bodyInput?.focus();
    bodyInput?.select();
  }

  function focusNextEditField(current: 'title' | 'tag' | 'body') {
    if (current === 'title') {
      focusEditField(tagInput ? 'tag' : 'body');
      return;
    }

    if (current === 'tag') {
      focusEditField('body');
      return;
    }

    focusEditField('title');
  }

  function tagKey(tags: string[]) {
    return normalizeTagList(tags).slice().sort().join('\u0000');
  }

  function addDraftTag(rawTag: string) {
    const nextTag = normalizeTagName(rawTag);

    if (!nextTag) {
      draftTagInput = '';
      return;
    }

    draftTags = normalizeTagList([...draftTags, nextTag]);
    draftTagInput = '';
  }

  function commitDraftTagInput() {
    addDraftTag(draftTagInput);
  }

  function removeDraftTag(tag: string) {
    draftTags = draftTags.filter((currentTag) => currentTag !== tag);
  }

  async function saveAndLock() {
    const nextTitle = draftTitle.trim() || 'Untitled';
    const nextBody = draftBody;
    const nextTags = normalizeTagList([...draftTags, draftTagInput]);
    const currentTitle = data.label || 'Untitled';
    const titleChanged = normalizeNodeTitle(nextTitle) !== normalizeNodeTitle(currentTitle);
    const entityChanged = draftIsEntity !== isEntityPage;
    const changed =
      titleChanged ||
      nextBody !== bodyText ||
      tagKey(nextTags) !== tagKey(nodeTags) ||
      entityChanged;

    if (changed) {
      const updatePayload: Parameters<typeof nodeStore.updateNode>[0] = {
        id,
        body: nextBody,
        is_entity: draftIsEntity ? 1 : 0,
        tags: nextTags
      };

      if (titleChanged) {
        const currentState = get(nodeStore);
        const currentNodes = Array.from(currentState.nodes.values());

        if (hasNodeTitleConflict(currentNodes, nextTitle, id)) {
          titleError = `A node titled "${nextTitle}" already exists in this canvas.`;
          return;
        }

        updatePayload.title = nextTitle;
      }

      const success = await nodeStore.updateNode(updatePayload);

      if (!success) {
        return;
      }
    }

    titleError = null;
    nodeUiStore.endEdit(id);
  }

  function handleEditToggle() {
    if (isEditing) {
      void saveAndLock();
      return;
    }

    void beginEdit();
  }

  function handleExpandToggle() {
    if (isEditing) {
      return;
    }

    nodeUiStore.toggleExpanded(id);
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      focusNextEditField('title');
      return;
    }

    if (isSaveAndExitEditShortcut(e)) {
      e.preventDefault();
      void saveAndLock();
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      void saveAndLock();
    }
  }

  function handleBodyKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      focusNextEditField('body');
      return;
    }

    if (isSaveAndExitEditShortcut(e)) {
      e.preventDefault();
      void saveAndLock();
      return;
    }

    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void saveAndLock();
    }
  }

  function handleTagKeyDown(e: KeyboardEvent) {
    if (e.key === 'Tab') {
      e.preventDefault();
      focusNextEditField('tag');
      return;
    }

    if (isSaveAndExitEditShortcut(e)) {
      e.preventDefault();
      void saveAndLock();
      return;
    }

    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      commitDraftTagInput();
      return;
    }

    if (e.key === 'Backspace' && !draftTagInput && draftTags.length > 0) {
      e.preventDefault();
      draftTags = draftTags.slice(0, -1);
    }
  }

  function handleTagPaste(e: ClipboardEvent) {
    const pasted = e.clipboardData?.getData('text');

    if (!pasted) {
      return;
    }

    const nextTags = pasted
      .split(/[\n,]+/)
      .map((tag) => normalizeTagName(tag))
      .filter(Boolean);

    if (!nextTags.length) {
      return;
    }

    e.preventDefault();
    draftTags = normalizeTagList([...draftTags, ...nextTags]);
    draftTagInput = '';
  }

  const nodeWidth = $derived(isExpanded ? '400px' : '180px');
  const borderColor = $derived(
    isEditing
      ? '1px solid var(--accent)'
      : isTagHighlighted
        ? `1px solid ${rgbaFromHex(highlightHex, 0.55)}`
        : isSearchHit
          ? '1px solid var(--accent)'
          : selected
            ? '1px solid var(--text-main)'
            : '1px solid var(--border-color)'
  );
  const boxShadow = $derived(isExpanded ? 'var(--shadow-soft)' : 'none');

  function tagChipStyle(tag: string) {
    return `
      border-color: ${getTagColorWithAlpha(tag, 0.4)};
      background: ${getTagColorWithAlpha(tag, 0.18)};
      color: var(--text-main);
    `;
  }

  function handleReadonlyTagClick(tag: string) {
    onTagClick?.(tag);
  }

  function handleEntityReferenceClick(title: string) {
    onEntityClick?.(title);
  }
</script>

<div class="node-shell" style={`width: ${nodeWidth};`}>
  <div
    class="node-card"
    data-testid={`node-card-${id}`}
    style={`border: ${borderColor}; box-shadow: ${boxShadow}; --node-overlay-color: ${overlayColor};`}
  >
    <div class="node-header">
      {#if isEditing}
        <input
          bind:this={titleInput}
          bind:value={draftTitle}
          class="title-input nodrag"
          aria-label="Node title"
          onkeydown={handleTitleKeyDown}
          oninput={() => {
            titleError = null;
          }}
        />
      {:else}
        <div class="title-display">{data.label}</div>
      {/if}

      <div class="header-actions">
        <button
          class="mode-button nodrag"
          type="button"
          tabindex={isEditing ? -1 : 0}
          disabled={isEditing}
          aria-label={isExpanded ? 'Collapse node preview' : 'Expand node preview'}
          title={isExpanded ? 'Collapse node preview' : 'Expand node preview'}
          data-testid={`node-expand-toggle-${id}`}
          onclick={handleExpandToggle}
        >
          {#if isExpanded}
            <ChevronUp size={12} aria-hidden="true" />
          {:else}
            <ChevronDown size={12} aria-hidden="true" />
          {/if}
        </button>

        <button
          class="mode-button nodrag"
          type="button"
          tabindex={isEditing ? -1 : 0}
          aria-label={isEditing ? 'Save node' : 'Edit node'}
          title={isEditing ? 'Save node' : 'Edit node'}
          data-testid={isEditing ? `node-save-${id}` : `node-edit-${id}`}
          onclick={handleEditToggle}
        >
          {#if isEditing}
            <Check size={12} aria-hidden="true" />
          {:else}
            <Pencil size={12} aria-hidden="true" />
          {/if}
        </button>
      </div>
    </div>

    {#if isEditing && titleError}
      <p class="title-error" role="alert">{titleError}</p>
    {/if}

    {#if isEditing}
      <label class="entity-toggle nodrag">
        <input
          type="checkbox"
          tabindex="-1"
          bind:checked={draftIsEntity}
        />
        <span>Treat as entity page</span>
      </label>
    {/if}

    {#if isEditing || nodeTags.length}
      <div class="tags-area" class:tags-area--compact={nodeMode === 'compact'}>
        {#if isEditing}
          {#each draftTags as tag}
            <span class="tag-chip" data-testid={`node-edit-tag-${id}-${tag}`} style={tagChipStyle(tag)}>
              <span>{formatTagLabel(tag)}</span>
              <button
                class="tag-remove nodrag"
                type="button"
                tabindex={-1}
                aria-label={`Remove ${formatTagLabel(tag)}`}
                title={`Remove ${formatTagLabel(tag)}`}
                data-testid={`node-edit-tag-remove-${id}-${tag}`}
                onclick={() => removeDraftTag(tag)}
              >
                ×
              </button>
            </span>
          {/each}

          <span class="tag-input-shell">
            <span class="tag-prefix">#</span>
            <input
              bind:this={tagInput}
              bind:value={draftTagInput}
              class="tag-input nodrag"
              aria-label="Add tag"
              placeholder="Add tag"
              data-testid={`node-tag-input-${id}`}
              onkeydown={handleTagKeyDown}
              onpaste={handleTagPaste}
            />
          </span>
        {:else}
          {#each nodeTags as tag}
            <button
              type="button"
              class="tag-chip tag-chip-readonly nodrag"
              style={tagChipStyle(tag)}
              aria-pressed={data.activeTag === tag}
              aria-label={`Filter by ${formatTagLabel(tag)}`}
              title={`Filter by ${formatTagLabel(tag)}`}
              data-testid={`node-tag-${id}-${tag}`}
              onclick={() => handleReadonlyTagClick(tag)}
            >
              {formatTagLabel(tag)}
            </button>
          {/each}
        {/if}
      </div>
    {/if}

    {#if isExpanded}
      <div class="body-area">
        {#if isEditing}
          <textarea
            bind:this={bodyInput}
            bind:value={draftBody}
            class="body-editor nodrag"
            placeholder="Add body text"
            onkeydown={handleBodyKeyDown}
          ></textarea>
        {:else if bodyText}
          <div class="body-display">
            {#each bodySegments as segment (segment.startIndex)}
              {#if segment.type === 'entity'}
                <button
                  class="body-inline body-inline--entity nodrag"
                  class:body-inline--bold={segment.bold}
                  class:body-inline--italic={segment.italic}
                  type="button"
                  aria-label={`Jump to ${segment.title}`}
                  title={`Jump to ${segment.title}`}
                  onclick={(event) => {
                    event.stopPropagation();
                    handleEntityReferenceClick(segment.title);
                  }}
                >
                  {segment.text}
                </button>
              {:else if segment.type === 'link'}
                <a
                  class="body-inline body-inline--link nodrag"
                  class:body-inline--bold={segment.bold}
                  class:body-inline--italic={segment.italic}
                  href={segment.href}
                  rel="noreferrer"
                  target="_blank"
                  onclick={(event) => {
                    event.stopPropagation();
                  }}
                >
                  {segment.text}
                </a>
              {:else}
                <span
                  class="body-inline"
                  class:body-inline--bold={segment.bold}
                  class:body-inline--italic={segment.italic}
                >
                  {segment.text}
                </span>
              {/if}
            {/each}
          </div>
        {:else}
          <div class="body-placeholder">Add body text</div>
        {/if}
      </div>
    {/if}
  </div>

  <Handle id="target-top" type="target" position={Position.Top} />
  <Handle id="source-bottom" type="source" position={Position.Bottom} />
</div>

<style>
  .node-shell {
    transition: width 0.2s ease;
  }

  .node-card {
    position: relative;
    overflow: hidden;
    background: var(--surface);
    border-radius: 8px;
    padding: 10px 12px;
    transition:
      background-color 0.2s ease,
      border 0.2s ease,
      opacity 0.2s ease,
      box-shadow 0.2s ease,
      width 0.2s ease;
  }

  .node-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: var(--node-overlay-color, transparent);
    pointer-events: none;
  }

  .node-card > * {
    position: relative;
    z-index: 1;
  }

  .node-header {
    display: flex;
    align-items: center;
    gap: 8px;
    justify-content: space-between;
  }

  .title-display {
    min-width: 0;
    flex: 1;
    font-weight: 600;
    word-break: break-word;
    line-height: 1.25;
  }

  .title-input {
    min-width: 0;
    flex: 1;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 4px 6px;
    font: inherit;
    font-weight: 600;
    line-height: 1.25;
    outline: none;
    box-sizing: border-box;
  }

  .title-error {
    margin: 6px 0 0;
    color: #b42318;
    font-size: 0.75rem;
    line-height: 1.35;
  }

  .entity-toggle {
    display: inline-flex;
    align-items: center;
    gap: 0.45rem;
    margin: 6px 0 8px;
    color: var(--text-muted);
    font-size: 0.8rem;
    line-height: 1.2;
  }

  .entity-toggle input {
    margin: 0;
  }

  .header-actions {
    display: inline-flex;
    gap: 4px;
    flex: 0 0 auto;
  }

  .mode-button {
    width: 22px;
    height: 22px;
    border: 1px solid var(--border-color);
    background: var(--surface-soft);
    color: var(--text-main);
    border-radius: 4px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .mode-button:disabled {
    cursor: not-allowed;
    opacity: 0.55;
  }

  .body-area {
    margin-top: 8px;
  }

  .tags-area {
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: 6px;
    margin-bottom: 8px;
  }

  .tags-area--compact {
    margin-bottom: 0;
  }

  .tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    max-width: 100%;
    border: 1px solid #cfe0ff;
    border-radius: 999px;
    padding: 2px 7px;
    background: #eff6ff;
    color: var(--text-main);
    font-size: 12px;
    line-height: 1.2;
  }

  .tag-chip.tag-chip-readonly {
    cursor: pointer;
  }

  .tag-chip-readonly {
    white-space: nowrap;
  }

  .tag-remove {
    width: 14px;
    height: 14px;
    border: none;
    background: transparent;
    color: inherit;
    padding: 0;
    line-height: 1;
    font-size: 14px;
    cursor: pointer;
  }

  .tag-input-shell {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex: 1 1 120px;
    min-width: 120px;
    border: 1px solid var(--border-color);
    border-radius: 999px;
    padding: 2px 8px;
    background: var(--surface);
    box-sizing: border-box;
  }

  .tag-prefix {
    color: #888;
    font-size: 12px;
    line-height: 1;
    flex: 0 0 auto;
  }

  .tag-input {
    min-width: 0;
    width: 100%;
    border: none;
    outline: none;
    background: transparent;
    padding: 0;
    font: inherit;
    font-size: 12px;
    line-height: 1.2;
  }

  .body-display,
  .body-placeholder,
  .body-editor {
    width: 100%;
    box-sizing: border-box;
    font-size: 13px;
    line-height: 1.45;
  }

  .body-display {
    white-space: pre-wrap;
    word-break: break-word;
    color: var(--text-main);
  }

  .body-inline {
    display: inline;
  }

  .body-inline--bold {
    font-weight: 700;
  }

  .body-inline--italic {
    font-style: italic;
  }

  .body-inline--entity {
    border: 0;
    padding: 0;
    background: transparent;
    color: var(--accent);
    cursor: pointer;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 0.12em;
  }

  .body-inline--link {
    color: var(--accent);
  }

  .body-placeholder {
    color: var(--text-muted);
  }

  .body-editor {
    min-height: 96px;
    resize: vertical;
    border: 1px solid var(--border-color);
    border-radius: 4px;
    padding: 8px;
    outline: none;
    font: inherit;
    color: var(--text-main);
    background: var(--surface);
  }
</style>
