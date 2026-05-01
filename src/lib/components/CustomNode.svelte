<script lang="ts">
  import { tick } from 'svelte';
  import { Handle, Position } from '@xyflow/svelte';
  import { nodeStore } from '$lib/stores/nodeStore';
  import { nodeUiStore } from '$lib/stores/nodeUiStore';

  let { id, data, selected } = $props();

  let editingNodeId = $state<string | null>(null);
  let titleInput = $state<HTMLInputElement | undefined>(undefined);
  let bodyInput = $state<HTMLTextAreaElement | undefined>(undefined);
  let draftTitle = $state('');
  let draftBody = $state('');

  const isEditing = $derived(editingNodeId === id);
  const isExpanded = $derived(Boolean(selected) || isEditing);
  const bodyText = $derived(data.body ?? '');

  $effect(() => {
    const unsub = nodeUiStore.subscribe((v) => {
      editingNodeId = v.editingNodeId;
    });

    return unsub;
  });

  $effect(() => {
    if (!isEditing) {
      draftTitle = data.label || 'Untitled';
      draftBody = bodyText;
    }
  });

  async function beginEdit() {
    draftTitle = data.label || 'Untitled';
    draftBody = bodyText;
    nodeUiStore.beginEdit(id);
    await tick();
    titleInput?.focus();
    titleInput?.select();
  }

  function endEdit() {
    nodeUiStore.endEdit(id);
  }

  async function saveAndLock() {
    const nextTitle = draftTitle.trim() || 'Untitled';
    const nextBody = draftBody;
    const changed = nextTitle !== (data.label || 'Untitled') || nextBody !== bodyText;

    if (changed) {
      await nodeStore.updateNode({
        id,
        title: nextTitle,
        body: nextBody
      });
    }

    endEdit();
  }

  function handleEditToggle() {
    if (isEditing) {
      void saveAndLock();
      return;
    }

    void beginEdit();
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      void saveAndLock();
    }
  }

  function handleBodyKeyDown(e: KeyboardEvent) {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      void saveAndLock();
    }
  }

  const nodeWidth = $derived(isExpanded ? '360px' : '180px');
  const borderColor = $derived(
    isEditing
      ? '1px solid var(--accent)'
      : selected
        ? '1px solid var(--text-main)'
        : '1px solid #dcdcdc'
  );
  const boxShadow = $derived(isExpanded ? '0 4px 10px rgba(0,0,0,0.12)' : 'none');
</script>

<div class="node-shell" style={`width: ${nodeWidth};`}>
  <div class="node-card" style={`border: ${borderColor}; box-shadow: ${boxShadow};`}>
    <div class="node-header">
      {#if isEditing}
        <input
          bind:this={titleInput}
          bind:value={draftTitle}
          class="title-input nodrag"
          aria-label="Node title"
          onkeydown={handleTitleKeyDown}
        />
      {:else}
        <div class="title-display">{data.label}</div>
      {/if}

      <button
        class="mode-button nodrag"
        type="button"
        aria-label={isEditing ? 'Save node' : 'Edit node'}
        title={isEditing ? 'Save node' : 'Edit node'}
        onclick={handleEditToggle}
      >
        {#if isEditing}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M6.5 11.2 3.3 8l1.1-1.1 2.1 2.1 5-5 1.1 1.1-6.1 6.1z" />
          </svg>
        {:else}
          <svg viewBox="0 0 16 16" aria-hidden="true">
            <path d="M11.7 2.3a1 1 0 0 1 1.4 0l.6.6a1 1 0 0 1 0 1.4l-7.8 7.8-2.9.6.6-2.9 8.1-7.5zM3.2 12.8h9.6v1.4H3.2z" />
          </svg>
        {/if}
      </button>
    </div>

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
          <div class="body-display">{bodyText}</div>
        {:else}
          <div class="body-placeholder">Add body text</div>
        {/if}
      </div>
    {/if}
  </div>

  <Handle type="target" position={Position.Top} />
  <Handle type="source" position={Position.Bottom} />
</div>

<style>
  .node-shell {
    transition: width 0.2s ease;
  }

  .node-card {
    background: white;
    border-radius: 6px;
    padding: 10px 12px;
    transition:
      border 0.2s ease,
      box-shadow 0.2s ease,
      width 0.2s ease;
  }

  .node-header {
    display: flex;
    align-items: flex-start;
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
    border: 1px solid #dcdcdc;
    border-radius: 4px;
    padding: 4px 6px;
    font: inherit;
    font-weight: 600;
    line-height: 1.25;
    outline: none;
    box-sizing: border-box;
  }

  .mode-button {
    flex: 0 0 auto;
    width: 22px;
    height: 22px;
    border: 1px solid #dcdcdc;
    background: #f7f7f7;
    color: #333;
    border-radius: 4px;
    padding: 0;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
  }

  .mode-button svg {
    width: 12px;
    height: 12px;
    fill: currentColor;
  }

  .body-area {
    margin-top: 8px;
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
    color: #333;
  }

  .body-placeholder {
    color: #8a8a8a;
  }

  .body-editor {
    min-height: 96px;
    resize: vertical;
    border: 1px solid #dcdcdc;
    border-radius: 4px;
    padding: 8px;
    outline: none;
    font: inherit;
    color: #222;
  }
</style>
