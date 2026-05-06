# Playwright Follow-Ups

- Add explicit test hooks for panel controls and repeated labels so E2E selectors do not rely on broad text matches.
- Add stable hooks for XYFlow node actions, especially node edit/save controls and tag chips that overlap with canvas content.
    - Test hooks only?
- Keep the full Playwright suite as the built-app CI gate and the dev-mode spec as a smaller smoke check only.
    - Does this require any changes? Isn't this what we have now?
- Investigate the Svelte/Vite `$state.raw` warning seen in dev mode for node data, since it may indicate avoidable runtime churn.
- Review the node creation/edit flow in the product: `Add node` does not open the editor automatically, so document that behavior or consider making it more direct.
    - This is intentional for now. The workflow is "spawn then move then edit". 
    - However, arguably the new node should spawn in the center of the user's current viewport and not like the true canvas center, in which case editing immediately may be desirable?
