This is a full-stack typescript app for a mind map and notebook.

Front-end uses Svelte and XYFlow. Two backends: web and Tauri. Database is SQLite

Working rules:
- preserve unrelated user changes; do not revert work you did not make
- after code changes, run `npm run check` and `npm test` and report the result (you may skip for doc-only changes)
- keep changes scoped to the requested feature and follow existing Svelte, XYFlow, and SQLite patterns
- where appropriate, add tests to cover new behavior