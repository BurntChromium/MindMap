<script lang="ts">
	import { get } from 'svelte/store';
	import { Handle, Position } from '@xyflow/svelte';
	import { ChevronDown, ChevronUp, Pencil } from 'lucide-svelte';
	import { nodeStore } from '$lib/stores/nodeStore';
	import {
		getNodeMode,
		nodeUiStore,
		type NodeMode,
	} from '$lib/stores/nodeUiStore';
	import {
		formatTagLabel,
		normalizeTagName,
	} from '$lib/tagUtils';
	import { getTagColor, getTagColorWithAlpha, rgbaFromHex } from '$lib/tagColors';
	import CustomNodeEditPanel from './CustomNodeEditPanel.svelte';
	import CustomNodeReadOnlyBody from './CustomNodeReadOnlyBody.svelte';

	let { id, data, selected } = $props();

	let nodeMode = $state<NodeMode>('compact');

	const isEditing = $derived(nodeMode === 'edit');
	const isExpanded = $derived(nodeMode !== 'compact');
	const bodyText = $derived(data.body ?? '');
	const isEntityPage = $derived(Boolean(data.is_entity ?? 0));
	const onEntityClick = $derived(data.onEntityClick ?? null);
	const nodeTags = $derived(Array.isArray(data.tags) ? data.tags : []);
	const isSearchHit = $derived(Boolean(data.isSearchHit));
	const activeTagName = $derived(normalizeTagName(data.activeTag ?? ''));
	const activeTagColor = $derived(data.activeTagColor ?? null);
	const onTagClick = $derived(data.onTagClick ?? null);
	const highlightHex = $derived(activeTagColor ?? getTagColor(activeTagName));
	const isTagHighlighted = $derived(
		Boolean(activeTagName) && nodeTags.includes(activeTagName),
	);
	const overlayColor = $derived(
		isTagHighlighted ? rgbaFromHex(highlightHex, 0.22) : 'transparent',
	);

	$effect(() => {
		const unsub = nodeUiStore.subscribe((v) => {
			nodeMode = getNodeMode(v, id);
		});

		return unsub;
	});

	function handleEditToggle() {
		nodeUiStore.beginEdit(id);
	}

	function handleExpandToggle() {
		if (isEditing) {
			return;
		}

		nodeUiStore.toggleExpanded(id);
	}

	const nodeWidth = $derived(isExpanded ? '400px' : '180px');
	const borderColor = $derived(
		isEditing
			? '1px solid var(--accent)'
			: isTagHighlighted
				? `1px solid ${rgbaFromHex(highlightHex, 0.55)}`
				: isSearchHit
					? '1px solid var(--accent)'
					: selected
						? '1px solid var(--text-main)'
						: '1px solid var(--border-color)',
	);
	const boxShadow = $derived(isExpanded ? 'var(--shadow-soft)' : 'none');

	function tagChipStyle(tag: string) {
		return `
      border-color: ${getTagColorWithAlpha(tag, 0.4)};
      background: ${getTagColorWithAlpha(tag, 0.18)};
      color: var(--text-main);
    `;
	}

	function handleReadonlyTagClick(tag: string) {
		onTagClick?.(tag);
	}

	function handleEntityReferenceClick(title: string) {
		onEntityClick?.(title);
	}
</script>

<div class="node-shell" style={`width: ${nodeWidth};`}>
	<div
		class="node-card"
		data-testid={`node-card-${id}`}
		style={`border: ${borderColor}; box-shadow: ${boxShadow}; --node-overlay-color: ${overlayColor};`}
	>
		{#if isEditing}
			<CustomNodeEditPanel
				{id}
				label={data.label}
				{bodyText}
				{nodeTags}
				isEntityPage={isEntityPage}
				{isExpanded}
			/>
		{:else}
			<div class="node-readonly">
				<div class="node-header">
					<div class="title-display">{data.label}</div>

					<div class="header-actions">
						<button
							class="mode-button nodrag"
							type="button"
							tabindex={0}
							aria-label={isExpanded
								? 'Collapse node preview'
								: 'Expand node preview'}
							title={isExpanded
								? 'Collapse node preview'
								: 'Expand node preview'}
							data-testid={`node-expand-toggle-${id}`}
							onclick={handleExpandToggle}
						>
							{#if isExpanded}
								<ChevronUp size={12} aria-hidden="true" />
							{:else}
								<ChevronDown size={12} aria-hidden="true" />
							{/if}
						</button>

						<button
							class="mode-button nodrag"
							type="button"
							tabindex={0}
							aria-label="Edit node"
							title="Edit node"
							data-testid={`node-edit-${id}`}
							onclick={handleEditToggle}
						>
							<Pencil size={12} aria-hidden="true" />
						</button>
					</div>
				</div>

					{#if nodeTags.length}
						<div
							class="tags-area"
							class:tags-area--compact={!isExpanded}
						>
							{#each nodeTags as tag}
								<button
									type="button"
									class="tag-chip tag-chip-readonly nodrag"
									style={tagChipStyle(tag)}
									aria-pressed={data.activeTag === tag}
									aria-label={`Filter by ${formatTagLabel(tag)}`}
									title={`Filter by ${formatTagLabel(tag)}`}
									data-testid={`node-tag-${id}-${tag}`}
									onclick={() => handleReadonlyTagClick(tag)}
								>
									{formatTagLabel(tag)}
								</button>
							{/each}
						</div>
					{/if}

					{#if isExpanded}
						<div class="body-area">
							<CustomNodeReadOnlyBody
								{bodyText}
								onEntityClick={handleEntityReferenceClick}
							/>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<Handle id="target-top" type="target" position={Position.Top} />
	<Handle id="source-bottom" type="source" position={Position.Bottom} />
</div>

<style>
	.node-shell {
		transition: width 0.2s ease;
	}

	.node-card {
		position: relative;
		overflow: hidden;
		background: var(--surface);
		border-radius: 8px;
		padding: 10px 12px;
		transition:
			background-color 0.2s ease,
			border 0.2s ease,
			opacity 0.2s ease,
			box-shadow 0.2s ease,
			width 0.2s ease;
	}

	.node-card::before {
		content: '';
		position: absolute;
		inset: 0;
		background: var(--node-overlay-color, transparent);
		pointer-events: none;
	}

	.node-card > * {
		position: relative;
		z-index: 1;
	}

	.node-header {
		display: flex;
		align-items: center;
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

	.header-actions {
		display: inline-flex;
		gap: 4px;
		flex: 0 0 auto;
	}

	.mode-button {
		width: 22px;
		height: 22px;
		border: 1px solid var(--border-color);
		background: var(--surface-soft);
		color: var(--text-main);
		border-radius: 4px;
		padding: 0;
		display: inline-flex;
		align-items: center;
		justify-content: center;
		cursor: pointer;
	}

	.mode-button:disabled {
		cursor: not-allowed;
		opacity: 0.55;
	}

	.body-area {
		margin-top: 8px;
	}

	.tags-area {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
		margin-bottom: 8px;
	}

	.tags-area--compact {
		margin-bottom: 0;
	}

	.tag-chip {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		max-width: 100%;
		border: 1px solid #cfe0ff;
		border-radius: 999px;
		padding: 2px 7px;
		background: #eff6ff;
		color: var(--text-main);
		font-size: 12px;
		line-height: 1.2;
	}

	.tag-chip.tag-chip-readonly {
		cursor: pointer;
	}

	.tag-chip-readonly {
		white-space: nowrap;
	}
</style>
