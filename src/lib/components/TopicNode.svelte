<script lang="ts">
	import { NodeResizer } from '@xyflow/svelte';
	import { Pencil, Trash2 } from 'lucide-svelte';
	import { getTagColor, rgbaFromHex } from '$lib/tagColors';

	let { id, data, selected, width = 280, height = 180 } = $props();

	const titleColor = $derived(getTagColor(data.title ?? 'Topic'));
	const headerColor = $derived(rgbaFromHex(titleColor, 0.92));
	const bodyColor = $derived(rgbaFromHex(titleColor, 0.22));
	const borderColor = $derived(
		selected ? rgbaFromHex(titleColor, 0.9) : rgbaFromHex(titleColor, 0.5),
	);

	let titleDraft = $state('');
	let titleInput = $state<HTMLInputElement | undefined>(undefined);

	$effect(() => {
		titleDraft = data.title ?? 'Topic';
	});

	$effect(() => {
		if (!data.isEditing) {
			return;
		}

		queueMicrotask(() => {
			titleInput?.focus();
			titleInput?.select();
		});
	});

	function commitTitle() {
		const nextTitle = titleDraft.trim() || 'Topic';
		data.onCommitTitle?.(id, nextTitle);
	}

	function beginEdit() {
		data.onBeginEdit?.(id);
	}

	function handleTitleKeyDown(event: KeyboardEvent) {
		if (event.key === 'Enter') {
			event.preventDefault();
			commitTitle();
		}

		if (event.key === 'Escape') {
			event.preventDefault();
			titleDraft = data.title ?? 'Topic';
			data.onCancelEdit?.(id);
		}
	}
</script>

<div class="topic-shell" style={`width: ${width}px; height: ${height}px;`}>
	<div
		class="topic-card"
		data-testid={`topic-card-${id}`}
		style={`border-color: ${borderColor};`}
	>
		<div class="topic-card__header" style={`background: ${headerColor};`}>
			{#if data.isEditing}
				<input
					bind:this={titleInput}
					class="topic-card__title-input nodrag"
					type="text"
					bind:value={titleDraft}
					aria-label="Topic title"
					onblur={commitTitle}
					onkeydown={handleTitleKeyDown}
				/>
			{:else}
				<div class="topic-card__title">{data.title ?? 'Topic'}</div>
			{/if}

			<div class="topic-card__actions">
				<button
					class="icon-button topic-card__action nodrag"
					type="button"
					aria-label="Rename topic"
					title="Rename topic"
					onclick={beginEdit}
				>
					<Pencil size={12} aria-hidden="true" />
				</button>
				<button
					class="icon-button topic-card__action nodrag"
					type="button"
					aria-label="Delete topic"
					title="Delete topic"
					onclick={() => data.onDelete?.(id)}
				>
					<Trash2 size={12} aria-hidden="true" />
				</button>
			</div>
		</div>

		<div class="topic-card__body" style={`background: ${bodyColor};`}></div>
	</div>

	<NodeResizer
		isVisible={true}
		minWidth={120}
		minHeight={90}
		color={titleColor}
		onResizeEnd={(_, resize) => {
			data.onResize?.(id, resize);
		}}
	/>
</div>

<style>
	.topic-shell {
		position: relative;
		box-sizing: border-box;
	}

	.topic-card {
		position: relative;
		box-sizing: border-box;
		width: 100%;
		height: 100%;
		overflow: hidden;
		border: 1px solid transparent;
		border-radius: 12px;
		box-shadow: var(--shadow-soft);
	}

	.topic-card__header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
		padding: 0.55rem 0.7rem;
		color: #0f172a;
		font-weight: 700;
	}

	.topic-card__title {
		min-width: 0;
		flex: 1;
		word-break: break-word;
	}

	.topic-card__title-input {
		min-width: 0;
		flex: 1;
		border: 0;
		background: transparent;
		color: inherit;
		font: inherit;
		font-weight: inherit;
		outline: none;
		padding: 0;
	}

	.topic-card__actions {
		display: inline-flex;
		gap: 0.35rem;
		flex: none;
	}

	.topic-card__action {
		width: 22px;
		height: 22px;
		border-radius: 999px;
		border: 0;
		background: rgba(255, 255, 255, 0.28);
		color: #0f172a;
	}

	.topic-card__body {
		position: absolute;
		inset: 2.15rem 0 0 0;
	}
</style>
