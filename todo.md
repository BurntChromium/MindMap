# Playwright Follow-Ups

- Add explicit test hooks for panel controls and repeated labels so E2E selectors do not rely on broad text matches.
- Add stable hooks for XYFlow node actions, especially node edit/save controls and tag chips that overlap with canvas content.
- Keep the full Playwright suite as the built-app CI gate and the dev-mode spec as a smaller smoke check only.
- Review the node creation/edit flow in the product: `Add node` does not open the editor automatically, so document that behavior or consider making it more direct.
- Investigate the Svelte/Vite `$state.raw` warning seen in dev mode for node data, since it may indicate avoidable runtime churn.
- Delete stale `test-results/` artifacts after you are done inspecting the failing traces.
