<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { nodeStore } from '$lib/stores/nodeStore';

  let { id, data, selected } = $props();

  let isTitleEditing = $state(false);
  let bodyMode = $state<'display' | 'edit'>('display');
  let titleRef = $state<HTMLDivElement | undefined>(undefined);
  let bodyRef = $state<HTMLTextAreaElement | undefined>(undefined);
  let bodyDraft = $state('');

  const bodyText = $derived(data.body ?? '');
  const isExpanded = $derived(Boolean(selected));
  const isBodyEditing = $derived(bodyMode === 'edit');

  $effect(() => {
    if (!isBodyEditing) {
      bodyDraft = bodyText;
    }
  });

  function focusTitleEnd() {
    setTimeout(() => {
      if (!titleRef) return;

      titleRef.focus();

      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(titleRef);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 0);
  }

  function focusBody() {
    setTimeout(() => {
      if (!bodyRef) return;

      bodyRef.focus();
      bodyRef.setSelectionRange(bodyRef.value.length, bodyRef.value.length);
    }, 0);
  }

  function handleDoubleClick() {
    isTitleEditing = true;
    focusTitleEnd();
  }

  function handleTitleBlur(e: FocusEvent) {
    isTitleEditing = false;
    const target = e.target as HTMLElement;
    const newTitle = target.innerText.trim();

    if (newTitle !== data.label) {
      nodeStore.updateNode({ id, title: newTitle || 'Untitled' });
    }
  }

  function handleTitleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleRef?.blur();
    }
  }

  function startBodyEdit() {
    bodyMode = 'edit';
    focusBody();
  }

  function toggleBodyMode() {
    if (isBodyEditing) {
      bodyRef?.blur();
      return;
    }

    startBodyEdit();
  }

  async function commitBody() {
    bodyMode = 'display';

    if (bodyDraft !== bodyText) {
      await nodeStore.updateNode({ id, body: bodyDraft });
    }
  }

  function handleBodyBlur() {
    void commitBody();
  }

  function handleBodyKeyDown(e: KeyboardEvent) {
    if (e.key === 'Escape') {
      e.preventDefault();
      bodyRef?.blur();
    }
  }

  $effect(() => {
    if (!selected && isBodyEditing) {
      void commitBody();
    }
  });

  const nodeWidth = $derived(isExpanded ? '360px' : '180px');
  const borderColor = $derived(
    isTitleEditing || isBodyEditing
      ? '1px solid var(--accent)'
      : selected
        ? '1px solid var(--text-main)'
        : '1px solid #dcdcdc'
  );
  const boxShadow = $derived(selected ? '0 4px 10px rgba(0,0,0,0.12)' : 'none');
</script>

<div
  class="node-shell"
  style={`width: ${nodeWidth};`}
>
  <div
    class="node-card"
    style={`border: ${borderColor}; box-shadow: ${boxShadow};`}
  >
    <div class="node-header">
      <div
        bind:this={titleRef}
        class:editing={isTitleEditing}
        role="textbox"
        tabindex="0"
        aria-multiline="false"
        contenteditable={isTitleEditing}
        ondblclick={handleDoubleClick}
        onblur={handleTitleBlur}
        onkeydown={handleTitleKeyDown}
      >
        {data.label}
      </div>

      {#if selected}
        <button class="mode-button" onclick={toggleBodyMode}>
          {isBodyEditing ? 'Done' : 'Edit'}
        </button>
      {/if}
    </div>

    {#if isExpanded}
      <div class="body-area">
        {#if isBodyEditing}
          <textarea
            bind:this={bodyRef}
            bind:value={bodyDraft}
            class="body-editor"
            onblur={handleBodyBlur}
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
    align-items: start;
    gap: 8px;
    justify-content: space-between;
  }

  .node-header > div:first-child {
    min-width: 0;
    flex: 1;
    font-weight: 600;
    outline: none;
    word-break: break-word;
  }

  .node-header > div:first-child.editing {
    cursor: text;
  }

  .mode-button {
    flex: 0 0 auto;
    border: 1px solid #dcdcdc;
    background: #f7f7f7;
    color: #333;
    border-radius: 4px;
    padding: 2px 8px;
    font-size: 12px;
    line-height: 1.4;
    cursor: pointer;
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
