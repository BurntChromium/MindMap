<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { nodeStore } from '$lib/stores/nodeStore';

  let { id, data } = $props();
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
</script>

<div 
  style="background: white; border: 2px solid {isEditing ? '#007bff' : '#777'}; padding: 10px; border-radius: 5px; transition: border-color 0.2s;"
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
