<script lang="ts">
	import { X } from 'lucide-svelte';
	import { tick } from 'svelte';
	import type { ShortcutHelpSection } from '$lib/shortcutHelp';

	interface Props {
		open: boolean;
		sections: ShortcutHelpSection[];
		onClose: () => void;
	}

	let { open, sections, onClose }: Props = $props();
	let closeButtonRef = $state<HTMLButtonElement | undefined>(undefined);
	let previousOpen = $state(false);

	$effect(() => {
		if (!open || previousOpen) {
			previousOpen = open;
			return;
		}

		previousOpen = open;

		void tick().then(() => {
			closeButtonRef?.focus();
		});
	});

	function handleKeyDown(event: KeyboardEvent) {
		if (event.key !== 'Escape') {
			return;
		}

		event.preventDefault();
		onClose();
	}
</script>

{#if open}
	<div class="shortcut-help-backdrop" aria-hidden="true" onclick={onClose}></div>
	<div class="shortcut-help-layer">
		<div
			class="shortcut-help-dialog"
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-labelledby="shortcut-help-title"
			data-testid="shortcut-help-dialog"
			onkeydown={handleKeyDown}
			onclick={(event) => event.stopPropagation()}
		>
			<div class="shortcut-help-dialog__header">
				<div>
					<p class="shortcut-help-dialog__eyebrow">Help</p>
					<h3 id="shortcut-help-title">Keyboard shortcuts</h3>
				</div>
				<button
					bind:this={closeButtonRef}
					class="icon-button shortcut-help-dialog__close"
					type="button"
					aria-label="Close keyboard shortcuts help"
					title="Close keyboard shortcuts help"
					onclick={onClose}
				>
					<X size={12} aria-hidden="true" />
				</button>
			</div>

			<p class="shortcut-help-dialog__intro">
				These are the shortcuts available in the canvas and editor. Press
				<kbd>?</kbd> from the canvas to open this dialog.
			</p>

			<div class="shortcut-help-grid">
				{#each sections as section}
					<section class="shortcut-help-section" aria-label={section.title}>
						<h4>{section.title}</h4>
						<ul class="shortcut-help-list">
							{#each section.shortcuts as shortcut}
								<li class="shortcut-help-item">
									<div class="shortcut-help-item__keys">
										{#each shortcut.keys as key}
											<kbd>{key}</kbd>
										{/each}
									</div>
									<span>{shortcut.description}</span>
								</li>
							{/each}
						</ul>
					</section>
				{/each}
			</div>
		</div>
	</div>
{/if}

<style>
	.shortcut-help-backdrop {
		position: fixed;
		inset: 0;
		z-index: 30;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
	}

	.shortcut-help-layer {
		position: fixed;
		inset: 0;
		z-index: 31;
		display: grid;
		place-items: center;
		padding: 1rem;
		pointer-events: none;
	}

	.shortcut-help-dialog {
		pointer-events: auto;
		display: grid;
		gap: 1rem;
		width: min(720px, calc(100vw - 2rem));
		max-height: min(80vh, 760px);
		padding: 1rem 1.1rem 1.1rem;
		border: 1px solid rgba(148, 163, 184, 0.45);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.98);
		box-shadow: var(--shadow-soft);
		color: var(--text-main);
		overflow: auto;
	}

	.shortcut-help-dialog__header {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
	}

	.shortcut-help-dialog__eyebrow {
		margin: 0 0 0.15rem;
		color: var(--text-muted);
		font-size: 0.78rem;
		font-weight: 600;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.shortcut-help-dialog h3,
	.shortcut-help-section h4 {
		margin: 0;
	}

	.shortcut-help-dialog h3 {
		font-size: 1.05rem;
		line-height: 1.25;
	}

	.shortcut-help-dialog__close {
		flex: none;
	}

	.shortcut-help-dialog__intro {
		margin: 0;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.shortcut-help-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
		gap: 1rem;
	}

	.shortcut-help-section {
		display: grid;
		gap: 0.7rem;
		padding: 0.85rem;
		border: 1px solid rgba(226, 232, 240, 0.95);
		border-radius: 0.85rem;
		background: rgba(248, 250, 252, 0.95);
	}

	.shortcut-help-section h4 {
		font-size: 0.92rem;
		line-height: 1.25;
	}

	.shortcut-help-list {
		display: grid;
		gap: 0.7rem;
	}

	.shortcut-help-item {
		display: grid;
		gap: 0.35rem;
	}

	.shortcut-help-item__keys {
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}

	.shortcut-help-item kbd {
		padding: 0.05rem 0.35rem;
		border: 1px solid rgba(148, 163, 184, 0.6);
		border-radius: 0.35rem;
		background: rgba(255, 255, 255, 0.96);
		font: inherit;
		font-size: 0.82em;
		color: var(--text-main);
	}

	.shortcut-help-item span {
		color: var(--text-muted);
		font-size: 0.9rem;
		line-height: 1.35;
	}
</style>
