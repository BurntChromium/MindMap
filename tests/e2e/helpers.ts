import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import Database from 'better-sqlite3';
import type { APIRequestContext } from '@playwright/test';

const helperDir = mkdtempSync(join(tmpdir(), 'mindmap-e2e-helper-'));
const blankDbPath = join(helperDir, 'blank.db');
const blankDb = new Database(blankDbPath);
blankDb.exec('CREATE TABLE IF NOT EXISTS seed_marker (id INTEGER PRIMARY KEY)');
blankDb.close();

export const blankDatabaseBytes = readFileSync(blankDbPath);

export function cleanupHelperArtifacts() {
  rmSync(helperDir, { recursive: true, force: true });
}

async function postJson(request: APIRequestContext, path: string, body: unknown) {
  const response = await request.post(path, {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify(body)
  });

  if (!response.ok()) {
    throw new Error(`${path} failed with ${response.status()}: ${await response.text()}`);
  }

  return response.json();
}

export async function resetDatabase(request: APIRequestContext) {
  const response = await request.post('/api/database', {
    headers: { 'Content-Type': 'application/octet-stream' },
    data: blankDatabaseBytes
  });

  if (!response.ok()) {
    throw new Error(`/api/database reset failed with ${response.status()}: ${await response.text()}`);
  }
}

export async function seedCanvas(
  request: APIRequestContext,
  input: { id: string; name: string }
) {
  return postJson(request, '/api/canvases', input);
}

export async function seedNode(
  request: APIRequestContext,
  input: {
    id: string;
    canvasId: string;
    title: string;
    body?: string;
    tags?: string[];
    x?: number;
    y?: number;
    isEntity?: boolean;
  }
) {
  return postJson(request, '/api/nodes', {
    id: input.id,
    canvasId: input.canvasId,
    title: input.title,
    body: input.body ?? '',
    tags: input.tags ?? [],
    x: input.x ?? 0,
    y: input.y ?? 0,
    isEntity: input.isEntity ?? false,
    collapsed: 0
  });
}

export async function seedEdge(
  request: APIRequestContext,
  input: { id: string; canvasId: string; source: string; target: string }
) {
  return postJson(request, '/api/edges', input);
}
