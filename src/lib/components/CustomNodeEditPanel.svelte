<script lang="ts">
	import { get } from 'svelte/store';
	import { Check, ChevronDown, ChevronUp } from 'lucide-svelte';
	import { nodeStore } from '$lib/stores/nodeStore';
	import {
		nodeUiStore,
		type NodeEditDiscardField,
		type NodeUiState,
	} from '$lib/stores/nodeUiStore';
	import { formatTagLabel, normalizeTagList } from '$lib/tagUtils';
	import { hasNodeTitleConflict, normalizeNodeTitle } from '$lib/nodeTitles';
	import {
		getCommittedNodeEditTags,
		isNodeEditDraftDirty,
		type NodeEditBaseline,
	} from '$lib/nodeEditDraft';
	import { getTagColorWithAlpha } from '$lib/tagColors';
	import {
		getNextEditField,
		parsePastedTags,
		type CustomNodeEditField,
	} from '$lib/customNodeEdit';

	interface Props {
		id: string;
		label: string;
		bodyText: string;
		nodeTags: string[];
		isEntityPage: boolean;
		isExpanded: boolean;
	}

	let {
		id,
		label,
		bodyText,
		nodeTags,
		isEntityPage,
		isExpanded,
	}: Props = $props();

	let titleInput = $state<HTMLInputElement | undefined>(undefined);
	let tagInput = $state<HTMLInputElement | undefined>(undefined);
	let bodyInput = $state<HTMLTextAreaElement | undefined>(undefined);
	let draftTitle = $state('');
	let draftBody = $state('');
	let draftTags = $state<string[]>([]);
	let draftTagInput = $state('');
	let draftIsEntity = $state(false);
	let titleError = $state<string | null>(null);
	let editBaseline = $state<NodeEditBaseline | null>(null);
	let discardPromptRestoreField = $state<NodeEditDiscardField | null>(null);
	let previousDiscardPromptOpen = false;
	let nodeUiState = $state<NodeUiState>({
		editingNodeId: null,
		expandedNodeIds: {},
		discardPrompt: null,
	});

	$effect(() => {
		const unsub = nodeUiStore.subscribe((v: NodeUiState) => {
			nodeUiState = v;
		});

		return unsub;
	});

	$effect(() => {
		if (editBaseline) {
			return;
		}

		const nextBaseline = {
			title: label || 'Untitled',
			body: bodyText,
			tags: normalizeTagList(nodeTags),
			isEntity: isEntityPage,
		};

		editBaseline = nextBaseline;
		draftTitle = nextBaseline.title;
		draftBody = nextBaseline.body;
		draftTags = [...nextBaseline.tags];
		draftTagInput = '';
		draftIsEntity = nextBaseline.isEntity;
		titleError = null;
	});

	$effect(() => {
		const promptOpen = nodeUiState.discardPrompt?.nodeId === id;

		if (!promptOpen && previousDiscardPromptOpen && discardPromptRestoreField) {
			const fieldToRefocus = discardPromptRestoreField;
			queueMicrotask(() => {
				focusEditField(fieldToRefocus);
			});
			discardPromptRestoreField = null;
		}

		if (!promptOpen) {
			discardPromptRestoreField = null;
		}

		previousDiscardPromptOpen = promptOpen;
	});

	function focusEditField(target: CustomNodeEditField) {
		if (target === 'title') {
			titleInput?.focus();
			titleInput?.select();
			return;
		}

		if (target === 'tag') {
			tagInput?.focus();
			tagInput?.select();
			return;
		}

		bodyInput?.focus();
		bodyInput?.select();
	}

	function getEditBaseline() {
		return editBaseline as NodeEditBaseline;
	}

	function addDraftTag(rawTag: string) {
		const nextTag = rawTag.trim();

		if (!nextTag) {
			draftTagInput = '';
			return;
		}

		draftTags = normalizeTagList([...draftTags, nextTag]);
		draftTagInput = '';
	}

	function commitDraftTagInput() {
		addDraftTag(draftTagInput);
	}

	function removeDraftTag(tag: string) {
		draftTags = draftTags.filter((currentTag) => currentTag !== tag);
	}

	function closeDiscardPrompt() {
		nodeUiStore.clearDiscardPrompt();
	}

	function discardEdit() {
		closeDiscardPrompt();
		titleError = null;
		nodeUiStore.endEditCollapsed(id);
	}

	function openDiscardPrompt(field: NodeEditDiscardField) {
		discardPromptRestoreField = field;
		nodeUiStore.requestDiscardPrompt(id, field);
	}

	function handleEscapeFromField(field: NodeEditDiscardField) {
		const baseline = getEditBaseline();
		const dirty = isNodeEditDraftDirty(
			{
				title: draftTitle,
				body: draftBody,
				tags: draftTags,
				tagInput: draftTagInput,
				isEntity: draftIsEntity,
			},
			baseline,
		);

		if (!dirty) {
			discardEdit();
			return;
		}

		openDiscardPrompt(field);
	}

	async function saveAndLock() {
		const baseline = getEditBaseline();
		const nextTitle = draftTitle.trim() || 'Untitled';
		const nextBody = draftBody;
		const nextTags = getCommittedNodeEditTags(draftTags, draftTagInput);
		const changed = isNodeEditDraftDirty(
			{
				title: draftTitle,
				body: draftBody,
				tags: draftTags,
				tagInput: draftTagInput,
				isEntity: draftIsEntity,
			},
			baseline,
		);
		const titleDisplayChanged =
			normalizeNodeTitle(nextTitle) !== normalizeNodeTitle(baseline.title);

		if (changed) {
			const updatePayload: Parameters<typeof nodeStore.updateNode>[0] = {
				id,
				body: nextBody,
				is_entity: draftIsEntity ? 1 : 0,
				tags: nextTags,
			};

			if (titleDisplayChanged) {
				const currentState = get(nodeStore);
				const currentNodes = Array.from(currentState.nodes.values());

				if (hasNodeTitleConflict(currentNodes, nextTitle, id)) {
					titleError = `A node titled "${nextTitle}" already exists in this canvas.`;
					return;
				}

				updatePayload.title = nextTitle;
			}

			const success = await nodeStore.updateNode(updatePayload);

			if (!success) {
				return;
			}
		}

		titleError = null;
		nodeUiStore.endEdit(id);
	}

	function handleEditToggle() {
		void saveAndLock();
	}

	function handleTitleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			focusEditField(getNextEditField('title', !!tagInput));
			return;
		}

		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			handleEscapeFromField('title');
			return;
		}

		if (e.key === 'Enter') {
			e.preventDefault();
			void saveAndLock();
		}
	}

	function handleBodyKeyDown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			focusEditField(getNextEditField('body', !!tagInput));
			return;
		}

		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			handleEscapeFromField('body');
			return;
		}

		if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
			e.preventDefault();
			void saveAndLock();
		}
	}

	function handleTagKeyDown(e: KeyboardEvent) {
		if (e.key === 'Tab') {
			e.preventDefault();
			focusEditField(getNextEditField('tag', !!tagInput));
			return;
		}

		if (e.key === 'Escape') {
			e.preventDefault();
			e.stopPropagation();
			handleEscapeFromField('tag');
			return;
		}

		if (e.key === 'Enter' || e.key === ',') {
			e.preventDefault();
			commitDraftTagInput();
			return;
		}

		if (e.key === 'Backspace' && !draftTagInput && draftTags.length > 0) {
			e.preventDefault();
			draftTags = draftTags.slice(0, -1);
		}
	}

	function handleTagPaste(e: ClipboardEvent) {
		const pasted = e.clipboardData?.getData('text');

		if (!pasted) {
			return;
		}

		const nextTags = parsePastedTags(pasted);

		if (!nextTags.length) {
			return;
		}

		e.preventDefault();
		draftTags = normalizeTagList([...draftTags, ...nextTags]);
		draftTagInput = '';
	}
</script>

<div class="node-edit">
	<div class="node-header">
		<input
			bind:this={titleInput}
			bind:value={draftTitle}
			class="title-input nodrag"
			aria-label="Node title"
			onkeydown={handleTitleKeyDown}
			oninput={() => {
				titleError = null;
			}}
		/>

		<div class="header-actions">
			<button
				class="mode-button nodrag"
				type="button"
				tabindex={-1}
				disabled
				aria-label="Collapse node preview"
				title="Collapse node preview"
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
				aria-label="Save node"
				title="Save node"
				data-testid={`node-save-${id}`}
				onclick={handleEditToggle}
			>
				<Check size={12} aria-hidden="true" />
			</button>
		</div>
	</div>

	{#if titleError}
		<p class="title-error" role="alert">{titleError}</p>
	{/if}

	<label class="entity-toggle nodrag">
		<input type="checkbox" tabindex="-1" bind:checked={draftIsEntity} />
		<span>Treat as entity page</span>
	</label>

	{#if draftTags.length}
		<div class="tags-area">
			{#each draftTags as tag}
				<span
					class="tag-chip"
					data-testid={`node-edit-tag-${id}-${tag}`}
					style={`
						border-color: ${getTagColorWithAlpha(tag, 0.4)};
						background: ${getTagColorWithAlpha(tag, 0.18)};
						color: var(--text-main);
					`}
				>
					<span>{formatTagLabel(tag)}</span>
					<button
						class="tag-remove nodrag"
						type="button"
						tabindex={-1}
						aria-label={`Remove ${formatTagLabel(tag)}`}
						title={`Remove ${formatTagLabel(tag)}`}
						data-testid={`node-edit-tag-remove-${id}-${tag}`}
						onclick={() => removeDraftTag(tag)}
					>
						×
					</button>
				</span>
			{/each}
		</div>
	{/if}

	<div class="tag-input-shell">
		<span class="tag-prefix">#</span>
		<input
			bind:this={tagInput}
			bind:value={draftTagInput}
			class="tag-input nodrag"
			aria-label="Add tag"
			placeholder="Add tag"
			data-testid={`node-tag-input-${id}`}
			onkeydown={handleTagKeyDown}
			onpaste={handleTagPaste}
		/>
	</div>

	<div class="body-area">
		<textarea
			bind:this={bodyInput}
			bind:value={draftBody}
			class="body-editor nodrag"
			placeholder="Add body text"
			onkeydown={handleBodyKeyDown}
		></textarea>
	</div>
</div>

<style>
	.node-edit {
		display: grid;
		gap: 8px;
	}

	.node-header {
		display: flex;
		align-items: center;
		gap: 8px;
		justify-content: space-between;
	}

	.title-input {
		min-width: 0;
		flex: 1;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 4px 6px;
		font: inherit;
		font-weight: 600;
		line-height: 1.25;
		outline: none;
		box-sizing: border-box;
	}

	.title-error {
		margin: 0;
		color: #b42318;
		font-size: 0.75rem;
		line-height: 1.35;
	}

	.entity-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		color: var(--text-muted);
		font-size: 0.8rem;
		line-height: 1.2;
	}

	.entity-toggle input {
		margin: 0;
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

	.tags-area {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 6px;
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

	.tag-remove {
		width: 14px;
		height: 14px;
		border: none;
		background: transparent;
		color: inherit;
		padding: 0;
		line-height: 1;
		font-size: 14px;
		cursor: pointer;
	}

	.tag-input-shell {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		flex: 1 1 120px;
		min-width: 120px;
		border: 1px solid var(--border-color);
		border-radius: 999px;
		padding: 2px 8px;
		background: var(--surface);
		box-sizing: border-box;
	}

	.tag-prefix {
		color: #888;
		font-size: 12px;
		line-height: 1;
		flex: 0 0 auto;
	}

	.tag-input {
		min-width: 0;
		width: 100%;
		border: none;
		outline: none;
		background: transparent;
		padding: 0;
		font: inherit;
		font-size: 12px;
		line-height: 1.2;
	}

	.body-area {
		margin-top: 2px;
	}

	.body-editor {
		width: 100%;
		min-height: 96px;
		box-sizing: border-box;
		font-size: 13px;
		line-height: 1.45;
		resize: vertical;
		border: 1px solid var(--border-color);
		border-radius: 4px;
		padding: 8px;
		outline: none;
		font: inherit;
		color: var(--text-main);
		background: var(--surface);
	}
</style>
