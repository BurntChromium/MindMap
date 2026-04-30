<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { nodeStore } from '$lib/stores/nodeStore';

  let { id, data, selected } = $props();
  let isEditing = $state(false);
  let titleRef: HTMLDivElement;

  function handleDoubleClick() {
    isEditing = true;
    setTimeout(() => {
      titleRef.focus();
      // Move cursor to end
      const range = document.createRange();
      const sel = window.getSelection();
      range.selectNodeContents(titleRef);
      range.collapse(false);
      sel?.removeAllRanges();
      sel?.addRange(range);
    }, 0);
  }

  function handleBlur(e: FocusEvent) {
    isEditing = false;
    const target = e.target as HTMLElement;
    const newTitle = target.innerText;
    if (newTitle !== data.label) {
      nodeStore.updateNode({ id, title: newTitle });
    }
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter') {
      e.preventDefault();
      titleRef.blur();
    }
  }

  // Determine border style based on state
  let borderColor = $derived(isEditing ? '#007bff' : (selected ? '#000' : '#777'));
  let boxShadow = $derived(selected ? '0 4px 6px rgba(0,0,0,0.1)' : 'none');
</script>

<div 
  style="background: white; border: 2px solid {borderColor}; padding: 10px; border-radius: 5px; transition: all 0.2s; box-shadow: {boxShadow};"
  ondblclick={handleDoubleClick}
>
  <div
    bind:this={titleRef}
    contenteditable={isEditing}
    onblur={handleBlur}
    onkeydown={handleKeyDown}
    style="cursor: {isEditing ? 'text' : 'pointer'}; outline: none;"
  >
    {data.label}
  </div>
  <Handle type="target" position={Position.Top} />
  <Handle type="source" position={Position.Bottom} />
</div>
