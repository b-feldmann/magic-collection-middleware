# AGENTS.md

Express + MongoDB middleware (TypeScript) backing the `magic-collection-renderer` web app. Single package, no monorepo.

## Commands (use npm — `package-lock.json` is the lockfile)

- `npm run build` — webpack bundles `src/index.ts` → `build/index.js` (gitignored).
- `npm start` — runs the built `build/index.js` (build first).
- `npm run start:dev` — webpack in watch mode (uses `cross-env`, works cross-platform). Pair with `npm run run:dev` (nodemon on `build/index.js`) in a second terminal when actively developing.
- `npm test` — jest via ts-jest (`tests/**/*.test.ts`).
- `npm run lint` — eslint over `src` and `tests` (0 errors expected; `no-console` warnings are OK).

## Runtime setup

Requires a `.env` (see README) with `PORT`, `API_MONGO_ENDPOINT`, `API_MONGO_USER`, `API_MONGO_PASS`, `ACCESS_KEY`. The server connects to MongoDB Atlas on boot and only starts / registers routes inside the `MongoClient.connect` callback — no reachable DB means no running server.

`NODE_ENV` selects the database: `development` → `mtg-funset-test`, otherwise `mtg-funset`. The `/decks` routes use a separate `deck-builder` DB.

## Architecture / conventions

- `src/index.ts` is the entrypoint: wires routers under `/cards`, `/mechanics`, `/annotations`, `/user`, `/images`, `/decks`. Route registration lives inside the `client.connect()` promise callback (mongodb 6 driver, async/await in routes), guarded by `require.main === module`, so it does not run when imported (e.g. in tests).
- **Route factory pattern:** each file in `src/routes/` exports `createXRouter(dbase)` returning an `express.Router`. Follow this when adding routes and mount it in `index.ts`.
- **Auth on every handler:** compare against `process.env.ACCESS_KEY` — `req.query.accessKey` for GET, `req.body.accessKey` for POST/PUT — and `res.sendStatus(401)` on mismatch. New endpoints must replicate this.
- **ID mapping convention:** Mongo `_id` is renamed to `uuid` in API responses (and mapped back with `new ObjectId(uuid)` on writes). Keep this shape.
- Shared types live in `src/interfaces/` (`CardInterface`, `enums`, etc.).

## Style

TypeScript 5 is loose (no `strict`; only `sourceMap` + `esModuleInterop`). ESLint 8 (legacy `.eslintrc.js`) = airbnb + `@typescript-eslint` + prettier; prettier enforces `singleQuote: true` and `printWidth: 100`. `import/prefer-default-export` is off (named single exports allowed).
