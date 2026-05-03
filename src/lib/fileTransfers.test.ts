import { describe, expect, it } from 'vitest';
import { getDatabaseExportDestinationLabel } from './fileTransfers';

describe('fileTransfers', () => {
  it('describes a file-picker export destination', () => {
    expect(getDatabaseExportDestinationLabel(true, 'mindmap.db', 'notes.db')).toBe(
      'Saved as notes.db'
    );
  });

  it('describes a download export destination', () => {
    expect(getDatabaseExportDestinationLabel(false, 'mindmap.db')).toBe('Saved to Downloads');
  });
});
