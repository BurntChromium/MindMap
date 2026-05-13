<script lang="ts">
	import { parseInlineContent } from '$lib/inlineContent';

	interface Props {
		bodyText: string;
		onEntityClick: (title: string) => void;
	}

	let { bodyText, onEntityClick }: Props = $props();

	const bodySegments = $derived(parseInlineContent(bodyText));
</script>

{#if bodyText}
	<div class="body-display">
		{#each bodySegments as segment (segment.startIndex)}
			{#if segment.type === 'entity'}
				<button
					class="body-inline body-inline--entity nodrag"
					class:body-inline--bold={segment.bold}
					class:body-inline--italic={segment.italic}
					type="button"
					aria-label={`Jump to ${segment.title}`}
					title={`Jump to ${segment.title}`}
					onclick={(event) => {
						event.stopPropagation();
						onEntityClick(segment.title);
					}}
				>
					{segment.text}
				</button>
			{:else if segment.type === 'link'}
				<a
					class="body-inline body-inline--link nodrag"
					class:body-inline--bold={segment.bold}
					class:body-inline--italic={segment.italic}
					href={segment.href}
					rel="noreferrer"
					target="_blank"
					onclick={(event) => {
						event.stopPropagation();
					}}
				>
					{segment.text}
				</a>
			{:else}
				<span
					class="body-inline"
					class:body-inline--bold={segment.bold}
					class:body-inline--italic={segment.italic}
				>
					{segment.text}
				</span>
			{/if}
		{/each}
	</div>
{:else}
	<div class="body-placeholder">Add body text</div>
{/if}

<style>
	.body-display,
	.body-placeholder {
		width: 100%;
		box-sizing: border-box;
		font-size: 13px;
		line-height: 1.45;
	}

	.body-display {
		white-space: pre-wrap;
		word-break: break-word;
		color: var(--text-main);
	}

	.body-inline {
		display: inline;
	}

	.body-inline--bold {
		font-weight: 700;
	}

	.body-inline--italic {
		font-style: italic;
	}

	.body-inline--entity {
		border: 0;
		padding: 0;
		background: transparent;
		color: var(--accent);
		cursor: pointer;
		font: inherit;
		text-decoration: underline;
		text-underline-offset: 0.12em;
	}

	.body-inline--link {
		color: var(--accent);
	}

	.body-placeholder {
		color: var(--text-muted);
	}
</style>
