@AGENTS.md

## Context discipline (read as little as possible)
- **Never scan or read the whole repo.** Start from `idea/steps.md` to find the current phase,
  then open only the files that phase touches.
- Locate before reading: use Grep/Glob to find the symbol or file, then read just that file
  (or just the relevant line range if it's long).
- **Never read generated or vendored paths:** `core/build/`, `web/node_modules/`, `web/dist/`,
  `package-lock.json`, `web/public/data/` (generated plans), `web/public/wasm/` (compiled engine),
  `web/test-results/`, `web/playwright-report/`, and the `docs/*.png` screenshots.
- To inspect a plan, query it (`python3 -c` / `jq`) for the fields you need; plans are large.
- `idea/concepts.md` only grows: append to it; read only its headings (grep `^## `), not the whole file.
- Don't re-read a file you just wrote or edited; the tools already confirm the change.
- Headers in `core/include/` are the API. Read the header before the `.cpp`, and only open the
  `.cpp` if you need the implementation.
- Prefer short test output (`make -C core test 2>&1 | tail -20`) over full build logs.

## Teaching style
- The user is learning while building. **Teach in the chat itself**, not only in docs:
  after each phase, explain the concepts (plain words, then precise, then interview angle:
  complexity, edge cases, trade-offs).
- Also explain the **tooling** as it appears: compiler flags, Makefile, libraries and why we
  pick or skip them, WASM toolchain, test types (unit, property, e2e, CI/CD).
- Keep `idea/concepts.md` as the long-lived notes: append each phase's concepts there.
- Claude writes the code; keep it readable enough for the user to explain line by line.
- Verify with `make -C core test`, and for web changes `npm run build && npm run test:e2e` in `web/`.
