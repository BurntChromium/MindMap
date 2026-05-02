<script lang="ts">
  import {
    Check,
    ChevronLeft,
    ChevronRight,
    Download,
    PencilLine,
    Trash2,
    Upload,
    X
  } from 'lucide-svelte';
  import { appDataClient } from '$lib/appDataClient';
  import { saveBytesToFile } from '$lib/fileTransfers';
  import { canvasStore, type Canvas } from '$lib/stores/canvasStore';
  import { shouldCommitCanvasRename } from '$lib/routes/mindmapPage';

  interface Props {
    canvases: Canvas[];
    collapsed: boolean;
  }

  let { canvases, collapsed = $bindable(false) }: Props = $props();

  let name = $state('');
  let editingCanvasId = $state<string | null>(null);
  let editingCanvasName = $state('');
  let importInput: HTMLInputElement | null = null;
  let transferState = $state<'idle' | 'exporting' | 'importing'>('idle');

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

  async function exportDatabase() {
    if (transferState !== 'idle') {
      return;
    }

    transferState = 'exporting';

    try {
      const bytes = await appDataClient.exportDatabase();
      await saveBytesToFile(bytes, 'mindmap.db');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error(error);
      window.alert(`Export failed: ${String(error)}`);
    } finally {
      transferState = 'idle';
    }
  }

  async function importDatabase(event: Event) {
    if (transferState !== 'idle') {
      return;
    }

    const input = event.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';

    if (!file) {
      return;
    }

    const confirmed = window.confirm(
      `Replace the current database with "${file.name}"? This will overwrite your current data.`
    );

    if (!confirmed) {
      return;
    }

    transferState = 'importing';

    try {
      const bytes = await file.arrayBuffer();
      const result = (await appDataClient.importDatabase(bytes)) as
        | { success?: boolean; error?: unknown }
        | null;

      if (!result || ('success' in result && result.success === false)) {
        const message =
          result && typeof result.error === 'string' ? result.error : 'Import failed.';
        throw new Error(message);
      }

      window.location.reload();
    } catch (error) {
      console.error(error);
      window.alert(`Import failed: ${String(error)}`);
    } finally {
      transferState = 'idle';
    }
  }
</script>

<div class="sidebar" class:sidebar--collapsed={collapsed}>
  <div class="sidebar-topbar">
    <div class="sidebar-topbar__title">
      <p class="sidebar-brand">{collapsed ? 'M' : 'Mindmap'}</p>
      <h3>{collapsed ? 'C' : 'Canvases'}</h3>
    </div>
    <button
      class="icon-button sidebar-toggle"
      type="button"
      aria-label={collapsed ? 'Expand left panel' : 'Collapse left panel'}
      title={collapsed ? 'Expand left panel (C)' : 'Collapse left panel (C)'}
      aria-expanded={!collapsed}
      onclick={() => (collapsed = !collapsed)}
    >
      {#if collapsed}
        <ChevronRight size={14} aria-hidden="true" />
      {:else}
        <ChevronLeft size={14} aria-hidden="true" />
      {/if}
    </button>
  </div>

  <div class="sidebar-section">
    <div class="sidebar-row">
      <input
        bind:value={name}
        class="sidebar-input"
        placeholder="New canvas"
        aria-label="New canvas name"
      />
      <button class="button button--primary" type="button" onclick={() => canvasStore.create(name)}>
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
              class="ghost-button sidebar-canvas-button"
              type="button"
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
                onclick={() => saveCanvasName(canvas.id)}
              >
                <Check size={14} aria-hidden="true" />
              </button>
              <button
                class="icon-button"
                type="button"
                aria-label={`Cancel rename for ${canvas.name}`}
                title={`Cancel rename for ${canvas.name}`}
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
                onclick={() => startRenameCanvas(canvas)}
              >
                <PencilLine size={14} aria-hidden="true" />
              </button>
              <button
                class="icon-button"
                type="button"
                aria-label={`Delete canvas ${canvas.name}`}
                title={`Delete canvas ${canvas.name}`}
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

  <div class="sidebar-footer">
    <input
      bind:this={importInput}
      class="sidebar-file-input"
      type="file"
      accept=".db,.sqlite,.sqlite3,application/x-sqlite3"
      onchange={importDatabase}
    />
    <button
      class="button sidebar-transfer-button"
      type="button"
      disabled={transferState !== 'idle'}
      onclick={exportDatabase}
    >
      <Download size={14} aria-hidden="true" />
      <span>{transferState === 'exporting' ? 'Exporting...' : 'Export DB'}</span>
    </button>
    <button
      class="button button--primary sidebar-transfer-button"
      type="button"
      disabled={transferState !== 'idle'}
      onclick={openImportPicker}
    >
      <Upload size={14} aria-hidden="true" />
      <span>{transferState === 'importing' ? 'Importing...' : 'Import DB'}</span>
    </button>
  </div>
</div>
