<script lang="ts">
  import { onMount } from 'svelte';
  import { useSvelteFlow } from '@xyflow/svelte';
  import type { CanvasStageApi } from '$lib/canvasApi';

  interface Props {
    onApiReady: (api: CanvasStageApi | null) => void;
  }

  let { onApiReady }: Props = $props();

  const flow = useSvelteFlow();
  const api: CanvasStageApi = {
    getViewport: () => flow.getViewport(),
    getNodesBounds: (nodes) => flow.getNodesBounds(nodes),
    setViewport: (viewport) => flow.setViewport(viewport),
    zoomIn: () => flow.zoomIn(),
    zoomOut: () => flow.zoomOut(),
    setCenter: (x, y, options) => flow.setCenter(x, y, options)
  };

  onMount(() => {
    onApiReady(api);

    return () => onApiReady(null);
  });
</script>
