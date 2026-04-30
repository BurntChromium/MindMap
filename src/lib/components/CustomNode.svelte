<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';
  import { nodeStore } from '$lib/stores/nodeStore';

  let { id, data } = $props();
  let isEditing = $state(false);

  function handleDoubleClick() {
    isEditing = true;
  }

  function handleBlur(e: FocusEvent) {
    isEditing = false;
    const target = e.target as HTMLElement;
    const newTitle = target.innerText;
    if (newTitle !== data.label) {
      nodeStore.updateNode({ id, title: newTitle });
    }
  }
</script>

<div 
  style="background: white; border: 1px solid #777; padding: 10px; border-radius: 5px;"
  ondblclick={handleDoubleClick}
>
  <div
    contenteditable={isEditing}
    onblur={handleBlur}
    style="outline: {isEditing ? '1px solid blue' : 'none'}; cursor: {isEditing ? 'text' : 'pointer'};"
  >
    {data.label}
  </div>
  <Handle type="target" position={Position.Top} />
  <Handle type="source" position={Position.Bottom} />
</div>
