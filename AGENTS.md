This is a full-stack typescript app for a mind map and notebook.

References:
- vision.md for the idea
- production-roadmap.md for the current productionization roadmap

Front-end uses Svelte and XYFlow. 

Database is SQLite

Working rules:
- preserve unrelated user changes; do not revert work you did not make
- after code changes, run `npm run check` and `npm test` and report the result
- keep changes scoped to the requested feature and follow existing Svelte, XYFlow, and SQLite patterns
- where appropriate, add tests to cover new behavior