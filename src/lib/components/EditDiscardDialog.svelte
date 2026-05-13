<script lang="ts">
	import { tick } from 'svelte';

	export type DiscardPrompt = {
		nodeId: string;
		field: 'title' | 'tag' | 'body';
	};

	interface Props {
		prompt: DiscardPrompt | null;
		onCancel: () => void;
		onConfirm: () => void;
	}

	let { prompt, onCancel, onConfirm }: Props = $props();
	let noButtonRef = $state<HTMLButtonElement | undefined>(undefined);
	let yesButtonRef = $state<HTMLButtonElement | undefined>(undefined);
	let previousPromptNodeId: string | null = null;

	$effect(() => {
		if (!prompt || prompt.nodeId === previousPromptNodeId) {
			previousPromptNodeId = prompt?.nodeId ?? null;
			return;
		}

		previousPromptNodeId = prompt.nodeId;

		void tick().then(() => {
			noButtonRef?.focus();
		});
	});

	function handleKeyDown(event: KeyboardEvent) {
		event.stopPropagation();

		if (event.key === 'Tab') {
			event.preventDefault();
			if (document.activeElement === noButtonRef) {
				yesButtonRef?.focus();
				return;
			}

			noButtonRef?.focus();
			return;
		}

		if (event.key.toLowerCase() === 'y') {
			event.preventDefault();
			onConfirm();
			return;
		}

		if (event.key.toLowerCase() === 'n' || event.key === 'Escape') {
			event.preventDefault();
			onCancel();
		}
	}
</script>

{#if prompt}
	<div class="edit-discard-backdrop" aria-hidden="true"></div>
	<div class="edit-discard-layer">
		<div
			class="edit-discard-dialog"
			tabindex="-1"
			role="dialog"
			aria-modal="true"
			aria-labelledby="edit-discard-title"
			aria-describedby="edit-discard-description"
			onkeydown={handleKeyDown}
		>
			<h3 id="edit-discard-title">Discard changes?</h3>
			<p id="edit-discard-description">
				Unsaved edits will be lost. Press <kbd>Y</kbd> for Yes or
				<kbd>N</kbd> for No.
			</p>
			<div class="edit-discard-actions">
				<button
					class="button"
					type="button"
					bind:this={noButtonRef}
					data-testid="discard-edit-no"
					onclick={onCancel}
				>
					No
				</button>
				<button
					class="button"
					type="button"
					bind:this={yesButtonRef}
					data-testid="discard-edit-yes"
					onclick={onConfirm}
				>
					Yes
				</button>
			</div>
		</div>
	</div>
{/if}

<style>
	.edit-discard-backdrop {
		position: fixed;
		inset: 0;
		z-index: 29;
		background: rgba(15, 23, 42, 0.45);
		backdrop-filter: blur(4px);
	}

	.edit-discard-layer {
		position: fixed;
		inset: 0;
		z-index: 30;
		display: grid;
		place-items: center;
		padding: 1rem;
		pointer-events: none;
	}

	.edit-discard-dialog {
		pointer-events: auto;
		display: grid;
		gap: 0.85rem;
		width: min(420px, calc(100vw - 2rem));
		padding: 1rem 1.1rem 1.1rem;
		border: 1px solid rgba(148, 163, 184, 0.45);
		border-radius: 1rem;
		background: rgba(255, 255, 255, 0.98);
		box-shadow: var(--shadow-soft);
		color: var(--text-main);
	}

	.edit-discard-dialog h3 {
		margin: 0;
		font-size: 1rem;
		line-height: 1.25;
	}

	.edit-discard-dialog p {
		margin: 0;
		color: var(--text-muted);
		line-height: 1.45;
	}

	.edit-discard-dialog kbd {
		padding: 0.05rem 0.35rem;
		border: 1px solid rgba(148, 163, 184, 0.6);
		border-radius: 0.35rem;
		background: rgba(248, 250, 252, 0.95);
		font: inherit;
		font-size: 0.82em;
		color: var(--text-main);
	}

	.edit-discard-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.65rem;
	}
</style>
