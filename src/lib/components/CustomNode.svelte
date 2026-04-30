<script lang="ts">
  import { Handle, Position } from '@xyflow/svelte';

  let { data } = $props();
</script>

<div style="background: white; border: 1px solid #777; padding: 10px; border-radius: 5px;">
  <strong>{data.label}</strong>
  <Handle type="target" position={Position.Top} />
  <Handle type="source" position={Position.Bottom} />
</div>
