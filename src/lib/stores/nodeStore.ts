import { get, writable } from 'svelte/store';
import { createClientId } from '$lib/clientId';
import { hasNodeTitleConflict, normalizeNodeTitle, resolveUniqueNodeTitle } from '$lib/nodeTitles';
import { buildBulkPositionsBody, buildBulkTagsBody, buildNodeCreateBody, buildNodePatchBody } from '$lib/mutationPayloads';
import { entityStore } from '$lib/stores/entityStore';
import { historyStore } from '$lib/stores/historyStore';
import { mutationStateStore } from '$lib/stores/mutationStateStore';

export type Node = {
  id: string;
  canvas_id: string;
  title: string;
  body: string;
  tags: string[];
  x: number;
  y: number;
  collapsed: number;
};

export type NodeTagUpdate = {
  id: string;
  tags: string[];
};

export type NodePositionUpdate = {
  id: string;
  x: number;
  y: number;
};

function createNodeStore() {
  const store = writable<{
    nodes: Map<string, Node>;
    activeCanvasId: string | null;
  }>({
    nodes: new Map(),
    activeCanvasId: null
  });
  const { subscribe, set, update } = store;
  const cacheByCanvasId = new Map<string, Node[]>();
  let loadToken = 0;

  function cloneNode(node: Node): Node {
    return {
      ...node,
      tags: [...node.tags]
    };
  }

  function snapshotNodes(nodes: Map<string, Node>) {
    return Array.from(nodes.values()).map(cloneNode);
  }

  function nodesToMap(nodes: Node[]) {
    const map = new Map<string, Node>();

    for (const node of nodes) {
      map.set(node.id, cloneNode(node));
    }

    return map;
  }

  function snapshotState(state = get(store)) {
    return {
      nodes: nodesToMap(snapshotNodes(state.nodes)),
      activeCanvasId: state.activeCanvasId
    };
  }

  function syncCache(state = get(store)) {
    if (!state.activeCanvasId) {
      return;
    }

    cacheByCanvasId.set(state.activeCanvasId, snapshotNodes(state.nodes));
  }

  function replaceState(nodes: Node[], activeCanvasId: string | null) {
    set({
      nodes: nodesToMap(nodes),
      activeCanvasId
    });

    if (activeCanvasId) {
      cacheByCanvasId.set(activeCanvasId, nodes.map(cloneNode));
    }
  }

  return {
    subscribe,

    hydrate(nodes: Node[], activeCanvasId: string | null = null) {
      replaceState(nodes, activeCanvasId);
    },

    async load(canvasId: string) {
      const current = get(store);
      const cached = cacheByCanvasId.get(canvasId);
      const requestToken = ++loadToken;
      mutationStateStore.beginLoad();

      if (current.activeCanvasId && current.activeCanvasId !== canvasId) {
        cacheByCanvasId.set(current.activeCanvasId, snapshotNodes(current.nodes));
      }

      if (cached) {
        set({
          nodes: nodesToMap(cached),
          activeCanvasId: canvasId
        });
      } else if (current.activeCanvasId !== canvasId) {
        set({
          nodes: new Map(),
          activeCanvasId: canvasId
        });
      }

      try {
        const res = await fetch(`/api/nodes?canvasId=${canvasId}`);
        const data: Array<Node & { tags?: unknown }> = await res.json();

        if (requestToken !== loadToken) {
          mutationStateStore.finishLoad(true);
          return false;
        }

        const normalized = data.map((node) => ({
          ...node,
          tags: Array.isArray(node.tags) ? node.tags : []
        }));

        cacheByCanvasId.set(canvasId, normalized.map(cloneNode));
        set({
          nodes: nodesToMap(normalized),
          activeCanvasId: canvasId
        });
        mutationStateStore.finishLoad(true);
        return true;
      } catch {
        if (requestToken !== loadToken) {
          mutationStateStore.finishLoad(true);
          return false;
        }

        if (!cached && current.activeCanvasId === canvasId) {
          syncCache();
        }

        mutationStateStore.finishLoad(false, `Failed to load nodes for ${canvasId}`);
        return false;
      }
    },

    async create(
      canvasId: string,
      x = 0,
      y = 0,
      options?: Partial<Pick<Node, 'id' | 'title' | 'body' | 'tags' | 'collapsed'>>
    ) {
      const current = get(store);
      const currentNodes = Array.from(current.nodes.values());
      const id = options?.id ?? createClientId('node');
      const title = resolveUniqueNodeTitle(currentNodes, options?.title);
      const newNode: Node = {
        id,
        canvas_id: canvasId,
        title,
        body: options?.body ?? '',
        tags: Array.isArray(options?.tags) ? [...options.tags] : [],
        x,
        y,
        collapsed: options?.collapsed ?? 0
      };
      let finalTitle = newNode.title;
      const previous = snapshotState();
      mutationStateStore.beginWrite();

      update((state) => {
        state.nodes.set(id, newNode);
        state.activeCanvasId = canvasId;
        return state;
      });
      try {
        const res = await fetch('/api/nodes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            buildNodeCreateBody({
              id,
              canvasId,
              x,
              y,
              title: newNode.title,
              body: newNode.body,
              tags: newNode.tags,
              collapsed: newNode.collapsed
            })
          )
        });

        if (!res.ok) {
          throw new Error(`Create node failed with ${res.status}`);
        }

        const responseBody = await res.json().catch(() => null);
        const resolvedTitle =
          typeof responseBody?.title === 'string' ? responseBody.title : newNode.title;
        finalTitle = resolvedTitle;

        if (resolvedTitle !== newNode.title) {
          update((state) => {
            const existing = state.nodes.get(id);

            if (existing) {
              state.nodes.set(id, {
                ...existing,
                title: resolvedTitle
              });
            }

            return state;
          });
        }

        cacheByCanvasId.set(canvasId, snapshotNodes(get(store).nodes));
        if (!historyStore.isReplaying()) {
          historyStore.record({
            label: 'Create node',
            undo: async () => nodeStore.remove(id),
            redo: async () =>
              nodeStore.create(canvasId, newNode.x, newNode.y, {
                id,
                title: finalTitle,
                body: newNode.body,
                tags: [...newNode.tags],
                collapsed: newNode.collapsed
              })
          });
        }
        await entityStore.load(canvasId);
        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        syncCache(previous);
        const message = error instanceof Error ? error.message : String(error);
        mutationStateStore.finishWrite(false, `Create node failed with ${message}`);
        console.error(error);
        return false;
      }
    },

    async updateNode(partial: Partial<Node> & { id: string }) {
      const previous = snapshotState();
      const before = previous.nodes.get(partial.id);
      const currentNodes = Array.from(previous.nodes.values());
      const nextNode = before ? { ...before, ...partial } : null;

      if (typeof partial.title === 'string' && !normalizeNodeTitle(partial.title)) {
        mutationStateStore.finishWrite(false, 'Node title cannot be empty.');
        return false;
      }

      if (typeof partial.title === 'string' && hasNodeTitleConflict(currentNodes, partial.title, partial.id)) {
        const nextTitle = normalizeNodeTitle(partial.title);
        mutationStateStore.finishWrite(
          false,
          `A node titled "${nextTitle}" already exists in this canvas.`
        );
        return false;
      }

      mutationStateStore.beginWrite();

      update((state) => {
        const existing = state.nodes.get(partial.id);
        if (existing) {
          state.nodes.set(partial.id, { ...existing, ...partial });
        }
        return state;
      });

      try {
        const response = await fetch('/api/nodes', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildNodePatchBody(partial))
        });

        if (!response.ok) {
          const body = await response.json().catch(() => null);
          const message =
            typeof body?.error === 'string'
              ? body.error
              : `Update node failed with ${response.status}`;
          throw new Error(message);
        }

        if (before && nextNode && !historyStore.isReplaying()) {
          historyStore.record({
            label: 'Update node',
            undo: async () =>
              nodeStore.updateNode({
                id: before.id,
                title: before.title,
                body: before.body,
                x: before.x,
                y: before.y,
                collapsed: before.collapsed,
                tags: [...before.tags]
              }),
            redo: async () =>
              nodeStore.updateNode({
                id: nextNode.id,
                title: nextNode.title,
                body: nextNode.body,
                x: nextNode.x,
                y: nextNode.y,
                collapsed: nextNode.collapsed,
                tags: [...nextNode.tags]
              })
          });
        }

        const refreshCanvasId = before?.canvas_id ?? previous.activeCanvasId;

        if (refreshCanvasId) {
          await entityStore.load(refreshCanvasId);
        }
        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        syncCache(previous);
        const message = error instanceof Error ? error.message : String(error);
        mutationStateStore.finishWrite(false, `Update node failed with ${message}`);
        console.error(error);
        return false;
      }

    },

    async updateNodeTags(updates: NodeTagUpdate[]) {
      if (!updates.length) {
        return true;
      }

      const previous = snapshotState();
      const nextTagsById = new Map(updates.map((update) => [update.id, [...update.tags]]));
      const previousTagsById = new Map(
        updates.map((update) => [update.id, previous.nodes.get(update.id)?.tags ? [...previous.nodes.get(update.id)!.tags] : []])
      );
      mutationStateStore.beginWrite();

      update((state) => {
        for (const [id, tags] of nextTagsById) {
          const existing = state.nodes.get(id);

          if (existing) {
            state.nodes.set(id, {
              ...existing,
              tags: [...tags]
            });
          }
        }

        return state;
      });
      try {
        const response = await fetch('/api/nodes/bulk-tags', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBulkTagsBody(updates))
        });

        if (!response.ok) {
          throw new Error(`Bulk tag update failed with ${response.status}`);
        }

        if (!historyStore.isReplaying()) {
          historyStore.record({
            label: 'Update tags',
            undo: async () =>
              nodeStore.updateNodeTags(
                updates.map((update) => ({
                  id: update.id,
                  tags: previousTagsById.get(update.id) ?? []
                }))
              ),
            redo: async () =>
              nodeStore.updateNodeTags(
                updates.map((update) => ({
                  id: update.id,
                  tags: [...update.tags]
                }))
              )
          });
        }

        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        syncCache(previous);
        mutationStateStore.finishWrite(false, `Bulk tag update failed with ${String(error)}`);
        console.error(error);
        return false;
      }

    },

    async updateNodePositions(updates: NodePositionUpdate[]) {
      if (!updates.length) {
        return true;
      }

      const previous = snapshotState();
      const nextPositionsById = new Map(updates.map((update) => [update.id, { x: update.x, y: update.y }]));
      const previousPositionsById = new Map(
        updates.map((update) => {
          const node = previous.nodes.get(update.id);
          return [update.id, node ? { x: node.x, y: node.y } : { x: update.x, y: update.y }];
        })
      );
      mutationStateStore.beginWrite();

      update((state) => {
        for (const [id, position] of nextPositionsById) {
          const existing = state.nodes.get(id);

          if (existing) {
            state.nodes.set(id, {
              ...existing,
              x: position.x,
              y: position.y
            });
          }
        }

        return state;
      });
      syncCache();

      try {
        const response = await fetch('/api/nodes/bulk-position', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildBulkPositionsBody(updates))
        });

        if (!response.ok) {
          throw new Error(`Bulk node position update failed with ${response.status}`);
        }

        if (!historyStore.isReplaying()) {
          historyStore.record({
            label: 'Move nodes',
            undo: async () =>
              nodeStore.updateNodePositions(
                updates.map((update) => ({
                  id: update.id,
                  x: previousPositionsById.get(update.id)?.x ?? update.x,
                  y: previousPositionsById.get(update.id)?.y ?? update.y
                }))
              ),
            redo: async () =>
              nodeStore.updateNodePositions(
                updates.map((update) => ({
                  id: update.id,
                  x: update.x,
                  y: update.y
                }))
              )
          });
        }

        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        syncCache(previous);
        mutationStateStore.finishWrite(false, `Bulk node position update failed with ${String(error)}`);
        console.error(error);
        return false;
      }
    },

    async remove(id: string) {
      const previous = snapshotState();
      const removedNode = previous.nodes.get(id);
      mutationStateStore.beginWrite();

      update((state) => {
        state.nodes.delete(id);
        return state;
      });

      syncCache();

      try {
        const res = await fetch(`/api/nodes?id=${id}`, { method: 'DELETE' });

        if (!res.ok) {
          throw new Error(`Delete node failed with ${res.status}`);
        }

        if (removedNode && !historyStore.isReplaying()) {
          historyStore.record({
            label: 'Delete node',
            undo: async () =>
              nodeStore.create(removedNode.canvas_id, removedNode.x, removedNode.y, {
                id: removedNode.id,
                title: removedNode.title,
                body: removedNode.body,
                tags: [...removedNode.tags],
                collapsed: removedNode.collapsed
              }),
            redo: async () => nodeStore.remove(removedNode.id)
          });
        }

        const refreshCanvasId = removedNode?.canvas_id ?? previous.activeCanvasId;

        if (refreshCanvasId) {
          await entityStore.load(refreshCanvasId);
        }
        mutationStateStore.finishWrite(true);
        return true;
      } catch (error) {
        set(previous);
        syncCache(previous);
        mutationStateStore.finishWrite(false, `Delete node failed with ${String(error)}`);
        console.error(error);
        return false;
      }
    }
  };
}

export const nodeStore = createNodeStore();
