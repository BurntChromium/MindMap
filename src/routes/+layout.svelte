<script lang="ts">
	import { onMount } from 'svelte';
	import favicon from '$lib/assets/favicon.svg';
	import { configureAppDataTransport } from '$lib/appRuntime';

	let { children } = $props();

	onMount(() => {
		configureAppDataTransport();
	});
</script>

<style global>
  @import '@xyflow/svelte/dist/style.css';
  @import '../app.css';
</style>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

{@render children()}
