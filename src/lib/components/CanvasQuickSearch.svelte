<script lang="ts">
	import { Search, X } from 'lucide-svelte';
	import { tick } from 'svelte';

	interface Props {
		open: boolean;
		searchQuery: string;
		onClose: () => void;
	}

	let { open, searchQuery = $bindable(''), onClose }: Props = $props();
	let inputRef = $state<HTMLInputElement | undefined>(undefined);
	let previousOpen = $state(false);

	$effect(() => {
		if (!open || previousOpen) {
			previousOpen = open;
			return;
		}

		previousOpen = open;

		void tick().then(() => {
			inputRef?.focus();
			inputRef?.select();
		});
	});
</script>

{#if open}
	<div class="canvas-search-bar">
		<Search size={14} aria-hidden="true" />
		<input
			bind:this={inputRef}
			bind:value={searchQuery}
			class="canvas-search-bar__input"
			placeholder="Search nodes"
			aria-label="Search nodes"
			onkeydown={(event) => {
				if (event.key === 'Escape') {
					event.preventDefault();
					onClose();
				}
			}}
		/>
		<button
			class="icon-button canvas-search-bar__clear"
			type="button"
			aria-label="Clear search"
			title="Clear search"
			onclick={() => {
				searchQuery = '';
				onClose();
			}}
			disabled={!searchQuery.trim()}
		>
			<X size={12} aria-hidden="true" />
		</button>
	</div>
{/if}

<style>
	.canvas-search-bar {
		position: absolute;
		right: 1rem;
		bottom: 3.5rem;
		z-index: 6;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		min-width: 260px;
		padding: 0.5rem 0.65rem;
		border: 1px solid rgba(148, 163, 184, 0.45);
		border-radius: 0.9rem;
		background: rgba(255, 255, 255, 0.96);
		box-shadow: var(--shadow-soft);
		backdrop-filter: blur(10px);
	}

	.canvas-search-bar__input {
		flex: 1 1 auto;
		min-width: 0;
		border: 0;
		background: transparent;
		color: var(--text-main);
		outline: none;
	}

	.canvas-search-bar__input::placeholder {
		color: var(--text-muted);
	}

	.canvas-search-bar__clear {
		flex: 0 0 auto;
		width: 1.5rem;
		height: 1.5rem;
	}
</style>
