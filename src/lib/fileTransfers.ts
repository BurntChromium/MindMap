export type ExportSaveResult = {
	destinationLabel: string;
};

export function getDatabaseExportDestinationLabel(
	usedFilePicker: boolean,
	suggestedName: string,
	fileName?: string,
) {
	if (usedFilePicker) {
		return `Saved as ${fileName ?? suggestedName}`;
	}

	return 'Saved to Downloads';
}

export async function saveBytesToFile(
	bytes: ArrayBuffer,
	suggestedName: string,
): Promise<ExportSaveResult> {
	if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
		const picker = window as Window & {
			showSaveFilePicker: (options?: {
				suggestedName?: string;
				types?: Array<{
					description?: string;
					accept: Record<string, string[]>;
				}>;
			}) => Promise<FileSystemFileHandle>;
		};

		const handle = await picker.showSaveFilePicker({
			suggestedName,
			types: [
				{
					description: 'SQLite database',
					accept: {
						'application/x-sqlite3': ['.db', '.sqlite', '.sqlite3'],
						'application/octet-stream': ['.db', '.sqlite', '.sqlite3'],
					},
				},
			],
		});

		const writable = await handle.createWritable();
		await writable.write(bytes);
		await writable.close();
		return {
			destinationLabel: getDatabaseExportDestinationLabel(
				true,
				suggestedName,
				handle.name,
			),
		};
	}

	const blob = new Blob([bytes], { type: 'application/x-sqlite3' });
	const url = URL.createObjectURL(blob);
	const link = document.createElement('a');

	link.href = url;
	link.download = suggestedName;
	link.rel = 'noreferrer';
	link.style.display = 'none';

	document.body.appendChild(link);
	link.click();
	link.remove();

	window.setTimeout(() => URL.revokeObjectURL(url), 1000);

	return {
		destinationLabel: getDatabaseExportDestinationLabel(false, suggestedName),
	};
}
