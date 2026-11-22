<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

## Status of the November 22 source import

This import contains the changes actually present in the supplied AI Studio ZIP,
not all of the features described in the separate implementation report.

- The phone, working-hours and order-pricing helpers and extended data types are
  included. The order-pricing helper is not yet connected to the checkout flow.
- `DRAFT_firestore.rules` is an inactive draft. `firebase.json` points to the
  existing `firestore.rules`; this import does not deploy or activate the draft.
- Partner isolation, daily booking sessions, atomic captain claims and the
  corresponding UI changes are not integrated in this snapshot.
- The reported API function, emulator tests and CI workflow are absent from the
  supplied ZIP. They must not be considered implemented or verified.
- The additional seed metadata is not accepted by the existing rules. Seeding
  must be reconciled with the validated rules before using it in production.
- The existing compatible `esbuild` dependency, complete `bun.lock`, production
  SEO metadata and public files are preserved from GitHub.

Checks available for this snapshot:

```sh
bun install --frozen-lockfile
bun run lint
bun x tsx --test src/lib/__tests__/fixes.test.ts
bun x eslint firestore.rules
bun run build
```

The `lint` script checks TypeScript types. It does not test authorization. Check
Firestore behavior with emulator tests before activating a new ruleset.

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/bd327efc-a997-4475-a7c6-ee14154881c2

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`
