<script lang="ts">
	import {
	Check,
	ChevronLeft,
	ChevronRight,
	Download,
	FolderOpen,
	PencilLine,
	RotateCcw,
	Trash2,
	Upload,
	X,
	} from 'lucide-svelte';
	import {
		appDataClient,
		type AppDataBackupSettings,
		type AppDataBackupStatus,
	} from '$lib/appDataClient';
	import PanelTabs from './PanelTabs.svelte';
	import { saveBytesToFile } from '$lib/fileTransfers';
	import { canvasStore, type Canvas } from '$lib/stores/canvasStore';
	import { shouldCommitCanvasRename } from '$lib/routes/mindmapPage';
	import { onDestroy } from 'svelte';

	interface Props {
		canvases: Canvas[];
		collapsed: boolean;
		databaseFileName: string;
		backupSettings: AppDataBackupSettings;
		backupStatus: AppDataBackupStatus;
		backupDirectoryConfigurable?: boolean;
		onExportSuccess?: (destinationLabel: string) => void;
		onDatabaseFileNameSave?: (databaseFileName: string) => Promise<void> | void;
		onBackupSettingsSave?: (
			backupSettings: AppDataBackupSettings,
		) => Promise<void> | void;
		onBackupNow?: () => Promise<AppDataBackupStatus> | void;
		onRestoreLatestBackup?: () => Promise<void> | void;
	}

	type SidebarTab = 'canvas' | 'database';

	let {
		canvases,
		collapsed = $bindable(false),
		databaseFileName,
		backupSettings,
		backupStatus,
		backupDirectoryConfigurable = true,
		onExportSuccess,
		onDatabaseFileNameSave,
		onBackupSettingsSave,
		onBackupNow,
		onRestoreLatestBackup,
	}: Props = $props();

	let name = $state('');
	let activeTab = $state<SidebarTab>('canvas');
	let editingCanvasId = $state<string | null>(null);
	let editingCanvasName = $state('');
	let importInput = $state<HTMLInputElement | null>(null);
	let operationState = $state<
		'idle' | 'exporting' | 'importing' | 'saving' | 'backing-up' | 'restoring'
	>('idle');
	let databaseFileNameDraft = $state('');
	let backupDirectoryPathDraft = $state('');
	let backupIntervalMinutesDraft = $state('');
	let backupRetentionCountDraft = $state('');
	let backupSettingsSaveTimer: ReturnType<typeof setTimeout> | null = null;
	let backupSettingsSaveInFlight = false;
	let pendingBackupSettings: AppDataBackupSettings | null = null;

	$effect(() => {
		databaseFileNameDraft = databaseFileName;
	});

	$effect(() => {
		backupDirectoryPathDraft = backupSettings.backupDirectoryPath;
		backupIntervalMinutesDraft = String(backupSettings.backupIntervalMinutes);
		backupRetentionCountDraft = String(backupSettings.backupRetentionCount);
	});

	function getTabTitle(tab: SidebarTab) {
		return tab === 'canvas' ? 'Canvases' : 'Database';
	}

	function getCollapsedTabTitle(tab: SidebarTab) {
		return tab === 'canvas' ? 'C' : 'D';
	}

	function startRenameCanvas(canvas: Canvas) {
		editingCanvasId = canvas.id;
		editingCanvasName = canvas.name;
	}

	async function saveCanvasName(canvasId: string) {
		await canvasStore.rename(canvasId, editingCanvasName);
		editingCanvasId = null;
		editingCanvasName = '';
	}

	function cancelRenameCanvas() {
		editingCanvasId = null;
		editingCanvasName = '';
	}

	function openImportPicker() {
		importInput?.click();
	}

	function clearBackupSettingsSaveTimer() {
		if (backupSettingsSaveTimer) {
			clearTimeout(backupSettingsSaveTimer);
			backupSettingsSaveTimer = null;
		}
	}

	function isSameBackupSettings(
		left: AppDataBackupSettings,
		right: AppDataBackupSettings,
	) {
		return (
			left.backupDirectoryPath === right.backupDirectoryPath &&
			left.backupIntervalMinutes === right.backupIntervalMinutes &&
			left.backupRetentionCount === right.backupRetentionCount
		);
	}

	function readBackupSettingsDraft() {
		const nextBackupDirectoryPath = backupDirectoryPathDraft.trim();
		const nextBackupIntervalMinutes = Number.parseInt(
			backupIntervalMinutesDraft,
			10,
		);
		const nextBackupRetentionCount = Number.parseInt(
			backupRetentionCountDraft,
			10,
		);

		if (!nextBackupDirectoryPath) {
			return null;
		}

		if (!Number.isInteger(nextBackupIntervalMinutes) || nextBackupIntervalMinutes < 1) {
			return null;
		}

		if (
			!Number.isInteger(nextBackupRetentionCount) ||
			nextBackupRetentionCount < 1
		) {
			return null;
		}

		return {
			backupDirectoryPath: nextBackupDirectoryPath,
			backupIntervalMinutes: nextBackupIntervalMinutes,
			backupRetentionCount: nextBackupRetentionCount,
		};
	}

	function queueBackupSettingsSave() {
		const nextBackupSettings = readBackupSettingsDraft();

		if (
			!nextBackupSettings ||
			!onBackupSettingsSave ||
			isSameBackupSettings(nextBackupSettings, backupSettings)
		) {
			clearBackupSettingsSaveTimer();
			pendingBackupSettings = null;
			return;
		}

		clearBackupSettingsSaveTimer();
		backupSettingsSaveTimer = setTimeout(() => {
			backupSettingsSaveTimer = null;
			void saveBackupConfiguration(nextBackupSettings);
		}, 350);
	}

	async function chooseBackupDirectory() {
		if (operationState !== 'idle' || !backupDirectoryConfigurable) {
			return;
		}

		const nextPath = await appDataClient.pickBackupDirectory({
			defaultPath: backupDirectoryPathDraft || backupSettings.backupDirectoryPath,
		});

		if (!nextPath) {
			return;
		}

		backupDirectoryPathDraft = nextPath;
		queueBackupSettingsSave();
	}

	function formatBackupTimestamp(timestamp: number | null) {
		if (!timestamp) {
			return 'Never';
		}

		return new Date(timestamp).toLocaleString();
	}

	async function exportDatabase() {
		if (operationState !== 'idle') {
			return;
		}

		operationState = 'exporting';

		try {
			const bytes = await appDataClient.exportDatabase();
			const result = await saveBytesToFile(
				bytes,
				databaseFileName || 'mindmap.db',
			);
			onExportSuccess?.(result.destinationLabel);
		} catch (error) {
			if (error instanceof DOMException && error.name === 'AbortError') {
				return;
			}

			console.error(error);
			window.alert(`Export failed: ${String(error)}`);
		} finally {
			operationState = 'idle';
		}
	}

	async function saveDatabaseFileName() {
		const nextFileName = databaseFileNameDraft.trim();

		if (
			!nextFileName ||
			nextFileName === databaseFileName ||
			operationState !== 'idle'
		) {
			return;
		}

		if (!onDatabaseFileNameSave) {
			return;
		}

		operationState = 'saving';

		try {
			await onDatabaseFileNameSave(nextFileName);
		} catch (error) {
			console.error(error);
			window.alert(`Database file update failed: ${String(error)}`);
		} finally {
			operationState = 'idle';
		}
	}

	async function saveBackupConfiguration(nextBackupSettings: AppDataBackupSettings) {
		if (backupSettingsSaveInFlight) {
			pendingBackupSettings = nextBackupSettings;
			return;
		}

		backupSettingsSaveInFlight = true;

		try {
			await onBackupSettingsSave?.(nextBackupSettings);
		} catch (error) {
			console.error(error);
			window.alert(`Backup settings failed: ${String(error)}`);
		} finally {
			backupSettingsSaveInFlight = false;
		}

		if (
			pendingBackupSettings &&
			!isSameBackupSettings(pendingBackupSettings, nextBackupSettings)
		) {
			const queuedBackupSettings = pendingBackupSettings;
			pendingBackupSettings = null;
			void saveBackupConfiguration(queuedBackupSettings);
			return;
		}

		pendingBackupSettings = null;
	}

	async function createBackupNow() {
		if (operationState !== 'idle' || !onBackupNow) {
			return;
		}

		operationState = 'backing-up';

		try {
			await onBackupNow();
		} catch (error) {
			console.error(error);
			window.alert(`Backup snapshot failed: ${String(error)}`);
		} finally {
			operationState = 'idle';
		}
	}

	async function restoreLatestBackupNow() {
		if (operationState !== 'idle' || !onRestoreLatestBackup) {
			return;
		}

		const confirmed = window.confirm(
			'Restore the most recent backup snapshot? This will replace the current database.',
		);

		if (!confirmed) {
			return;
		}

		operationState = 'restoring';

		try {
			await onRestoreLatestBackup();
		} catch (error) {
			console.error(error);
			window.alert(`Restore failed: ${String(error)}`);
		} finally {
			operationState = 'idle';
		}
	}

	async function importDatabase(event: Event) {
		if (operationState !== 'idle') {
			return;
		}

		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';

		if (!file) {
			return;
		}

		const confirmed = window.confirm(
			`Replace the current database with "${file.name}"? This will overwrite your current data.`,
		);

		if (!confirmed) {
			return;
		}

		operationState = 'importing';

		try {
			const bytes = await file.arrayBuffer();
			const result = (await appDataClient.importDatabase(bytes)) as {
				success?: boolean;
				error?: unknown;
			} | null;

			if (!result || ('success' in result && result.success === false)) {
				const message =
					result && typeof result.error === 'string'
						? result.error
						: 'Import failed.';
				throw new Error(message);
			}

			window.location.reload();
		} catch (error) {
			console.error(error);
			window.alert(`Import failed: ${String(error)}`);
		} finally {
			operationState = 'idle';
		}
	}

	onDestroy(() => {
		clearBackupSettingsSaveTimer();
	});
</script>

<div
	class="sidebar panel-shell panel-shell--left"
	class:panel-shell--collapsed={collapsed}
>
	<div class="sidebar-topbar">
		<div class="sidebar-topbar__title">
			<p class="sidebar-brand">{collapsed ? 'M' : 'Mindmap'}</p>
			<h3>
				{collapsed ? getCollapsedTabTitle(activeTab) : getTabTitle(activeTab)}
			</h3>
		</div>
		<button
			class="icon-button sidebar-toggle"
			type="button"
			aria-label={collapsed ? 'Expand left panel' : 'Collapse left panel'}
			title={collapsed ? 'Expand left panel (C)' : 'Collapse left panel (C)'}
			aria-expanded={!collapsed}
			data-testid="sidebar-toggle"
			onclick={() => (collapsed = !collapsed)}
		>
			{#if collapsed}
				<ChevronRight size={14} aria-hidden="true" />
			{:else}
				<ChevronLeft size={14} aria-hidden="true" />
			{/if}
		</button>
	</div>

	{#if !collapsed}
		<PanelTabs
			bind:activeTab
			ariaLabel="Left panel tabs"
			tabs={[
				{
					value: 'canvas',
					label: 'Canvas',
					testId: 'sidebar-tab-canvas',
					id: 'sidebar-tab-canvas',
					controls: 'sidebar-panel-canvas',
				},
				{
					value: 'database',
					label: 'Database',
					testId: 'sidebar-tab-database',
					id: 'sidebar-tab-database',
					controls: 'sidebar-panel-database',
				},
			]}
		/>
	{/if}

	{#if !collapsed && activeTab === 'canvas'}
		<div
			class="sidebar-section"
			id="sidebar-panel-canvas"
			role="tabpanel"
			aria-labelledby="sidebar-tab-canvas"
			data-testid="sidebar-panel-canvas"
		>
			<div class="sidebar-row">
				<input
					bind:value={name}
					class="sidebar-input"
					placeholder="New canvas"
					aria-label="New canvas name"
				/>
				<button
					class="button"
					type="button"
					data-testid="sidebar-create-canvas"
					onclick={() => canvasStore.create(name)}
				>
					<span>Create</span>
				</button>
			</div>
		</div>
		<div class="sidebar-section">
			<ul class="sidebar-list">
				{#each canvases as canvas}
					<li class="sidebar-row sidebar-canvas-row">
						{#if editingCanvasId === canvas.id}
							<input
								bind:value={editingCanvasName}
								class="sidebar-input sidebar-canvas-input"
								aria-label={`Rename canvas ${canvas.name}`}
								onkeydown={async (event) => {
									if (event.key === 'Enter') {
										event.preventDefault();
										await saveCanvasName(canvas.id);
									}

									if (event.key === 'Escape') {
										event.preventDefault();
										cancelRenameCanvas();
									}
								}}
								onblur={async (event) => {
									if (!shouldCommitCanvasRename(event.relatedTarget)) {
										return;
									}

									await saveCanvasName(canvas.id);
								}}
							/>
						{:else}
							<button
								class="ghost-button"
								type="button"
								data-testid={`sidebar-canvas-select-${canvas.id}`}
								onclick={() => canvasStore.setActive(canvas.id)}
							>
								<span>{canvas.name}</span>
							</button>
						{/if}

						<div class="sidebar-row-actions">
							{#if editingCanvasId === canvas.id}
								<button
									class="icon-button"
									type="button"
									aria-label={`Save canvas name ${canvas.name}`}
									title={`Save canvas name ${canvas.name}`}
									data-testid={`sidebar-canvas-save-${canvas.id}`}
									onclick={() => saveCanvasName(canvas.id)}
								>
									<Check size={14} aria-hidden="true" />
								</button>
								<button
									class="icon-button"
									type="button"
									aria-label={`Cancel rename for ${canvas.name}`}
									title={`Cancel rename for ${canvas.name}`}
									data-testid={`sidebar-canvas-cancel-${canvas.id}`}
									onclick={cancelRenameCanvas}
								>
									<X size={14} aria-hidden="true" />
								</button>
							{:else}
								<button
									class="icon-button"
									type="button"
									aria-label={`Rename canvas ${canvas.name}`}
									title={`Rename canvas ${canvas.name}`}
									data-testid={`sidebar-canvas-rename-${canvas.id}`}
									onclick={() => startRenameCanvas(canvas)}
								>
									<PencilLine size={14} aria-hidden="true" />
								</button>
								<button
									class="icon-button"
									type="button"
									aria-label={`Delete canvas ${canvas.name}`}
									title={`Delete canvas ${canvas.name}`}
									data-testid={`sidebar-canvas-delete-${canvas.id}`}
									onclick={() => canvasStore.remove(canvas.id)}
								>
									<Trash2 size={14} aria-hidden="true" />
								</button>
							{/if}
						</div>
					</li>
				{/each}
			</ul>
		</div>
	{/if}

	{#if !collapsed && activeTab === 'database'}
		<div
			class="sidebar-section sidebar-section--database"
			id="sidebar-panel-database"
			role="tabpanel"
			aria-labelledby="sidebar-tab-database"
			data-testid="sidebar-panel-database"
		>
			<div class="sidebar-topbar__title">
				<h3>Database</h3>
			</div>

			<div class="sidebar-section">
				<div class="sidebar-row">
					<label for="database-file-name">Name</label>
					<input
						id="database-file-name"
						bind:value={databaseFileNameDraft}
						class="sidebar-input"
						placeholder="mindmap.db"
						aria-label="Database name"
					/>
					<button
						class="button"
						type="button"
						disabled={operationState !== 'idle' ||
							databaseFileNameDraft.trim() === databaseFileName}
						data-testid="sidebar-save-database-file"
						onclick={saveDatabaseFileName}
					>
						<span>Apply</span>
					</button>
				</div>
				<div class="sidebar-section">
					<input
						bind:this={importInput}
						class="sidebar-file-input"
						type="file"
						accept=".db,.sqlite,.sqlite3,application/x-sqlite3"
						data-testid="sidebar-import-input"
						onchange={importDatabase}
					/>
					<button
						class="button sidebar-transfer-button"
						type="button"
						disabled={operationState !== 'idle'}
						data-testid="sidebar-export-db"
						onclick={exportDatabase}
					>
						<Download size={14} aria-hidden="true" />
						<span
							>{operationState === 'exporting'
								? 'Exporting...'
								: 'Export DB'}</span
						>
					</button>
					<button
						class="button sidebar-transfer-button"
						type="button"
						disabled={operationState !== 'idle'}
						data-testid="sidebar-import-db"
						onclick={openImportPicker}
					>
						<Upload size={14} aria-hidden="true" />
						<span
							>{operationState === 'importing'
								? 'Importing...'
								: 'Import DB'}</span
						>
					</button>
				</div>
			</div>

			<div class="sidebar-section">
				<div class="panel-shell__section-header">
					<h4>Automatic Backups</h4>
					<span>{backupStatus.backupCount} snapshots</span>
				</div>
				<div class="sidebar-row sidebar-row--stack">
					{#if backupDirectoryConfigurable}
						<div class="sidebar-row sidebar-row--tight">
							<span>Folder</span>
							<button
								id="backup-directory-path"
								class="sidebar-picker-button"
								type="button"
								disabled={operationState !== 'idle'}
								aria-label="Choose backup folder"
								title={backupDirectoryPathDraft || 'Choose backup folder'}
								data-testid="sidebar-choose-backup-folder"
								onclick={chooseBackupDirectory}
							>
								<FolderOpen size={14} aria-hidden="true" />
								<span>{backupDirectoryPathDraft || 'Choose backup folder'}</span>
							</button>
						</div>
					{/if}
					<div class="sidebar-row sidebar-row--tight">
						<label for="backup-interval-minutes">Interval</label>
						<input
							id="backup-interval-minutes"
							bind:value={backupIntervalMinutesDraft}
							class="sidebar-input"
							inputmode="numeric"
							type="number"
							min="1"
							step="1"
							aria-label="Backup interval in minutes"
							oninput={queueBackupSettingsSave}
						/>
						<span class="sidebar-inline-unit">Minutes</span>
					</div>
					<div class="sidebar-row sidebar-row--tight">
						<label for="backup-retention-count">Keep last</label>
						<input
							id="backup-retention-count"
							bind:value={backupRetentionCountDraft}
							class="sidebar-input"
							inputmode="numeric"
							type="number"
							min="1"
							step="1"
							aria-label="Backup retention count"
							oninput={queueBackupSettingsSave}
						/>
					</div>
				</div>
				<div class="sidebar-row sidebar-row--wrap">
					<button
						class="button"
						type="button"
						disabled={operationState !== 'idle' || !onBackupNow}
						data-testid="sidebar-create-backup"
						onclick={createBackupNow}
					>
						<span>
							{operationState === 'backing-up'
								? 'Snapshotting...'
								: 'Create snapshot now'}
						</span>
					</button>
					<button
						class="button"
						type="button"
						disabled={
							operationState !== 'idle' ||
							!onRestoreLatestBackup ||
							backupStatus.backupCount === 0
						}
						data-testid="sidebar-restore-backup"
						onclick={restoreLatestBackupNow}
					>
						<RotateCcw size={14} aria-hidden="true" />
						<span>
							{operationState === 'restoring'
								? 'Restoring...'
								: 'Restore latest backup'}
						</span>
					</button>
				</div>
				<p class="sidebar-note">
					Last backup: {formatBackupTimestamp(backupStatus.latestBackupCreatedAt)}
					{#if backupStatus.latestBackupFileName}
						<span> ({backupStatus.latestBackupFileName})</span>
					{/if}
				</p>
				<p class="sidebar-note">
					Backups are full SQLite snapshots. Retention controls how many files are
					kept locally.
				</p>
			</div>

		</div>
	{/if}
</div>

<style>
	.sidebar-section--database {
		padding-top: 1rem;
		border-top: var(--border-thin);
	}

	.sidebar-row--wrap {
		flex-wrap: wrap;
		align-items: flex-start;
	}

	.sidebar-row--stack {
		display: grid;
		gap: 0.65rem;
	}

	.sidebar-row--tight {
		align-items: center;
		justify-content: flex-start;
		flex-wrap: wrap;
	}

	.sidebar-row--tight > .sidebar-input {
		flex: 0 0 5.5rem;
	}

	.sidebar-inline-unit {
		color: var(--text-muted);
		font-size: 0.8rem;
	}

	.sidebar-picker-button {
		min-width: 0;
		flex: 1 1 auto;
		display: inline-flex;
		align-items: center;
		gap: 0.45rem;
		justify-content: flex-start;
		border: var(--border-thin);
		border-radius: var(--radius-md);
		padding: 0.45rem 0.65rem;
		background: var(--surface);
		color: var(--text-main);
		font-size: 0.85rem;
		text-align: left;
	}

	.sidebar-picker-button > span {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.sidebar-note {
		margin: 0;
		color: var(--text-muted);
		font-size: 0.82rem;
		line-height: 1.4;
	}

</style>
