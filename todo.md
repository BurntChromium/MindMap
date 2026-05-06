# Playwright Follow-Ups

- Investigate the Svelte/Vite `$state.raw` warning seen in dev mode for node data, since it may indicate avoidable runtime churn.
- Review the node creation/edit flow in the product: `Add node` does not open the editor automatically, so document that behavior or consider making it more direct.
    - This is intentional for now. The workflow is "spawn then move then edit". 
    - However, arguably the new node should spawn in the center of the user's current viewport and not like the true canvas center, in which case editing immediately may be desirable?
