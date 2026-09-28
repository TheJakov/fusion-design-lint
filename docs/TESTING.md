# Testing DesignLint

DesignLint has two kinds of tests. Only the first is automated.

## 1. Unit tests (automated, no Fusion needed)

```sh
npm install        # once: typescript + @types/node (dev only; nothing is added to the add-in)
npm test           # compiles tests/ and runs them with Node's built-in test runner
npm run typecheck  # type-checks DesignLint/ against the typings bundled with your Fusion install
npm run check      # both
```

The tests cover the **pure layer**: rules, the analysis engine, the model summary and utilities. They run on
plain `DesignModel` fixtures (`tests/fixtures/models.ts`), not Fusion API objects. Nothing here pretends to test
the Fusion API.

Covered cases (from the project brief): clean model, under-constrained sketch, problematic sketch, default names,
repeated hard-coded values, a mixed model. Also covered: deterministic ordering, rule-failure isolation,
extraction-issue grouping and ICU-free sorting. The fragile-reference case is a `todo` until Rule 5 exists.

`tsconfig.test.json` only compiles what the tests import. If a pure module ever imports `@adsk/fusion`, the
test build fails, which keeps Fusion API code out of the pure layer.

`npm run typecheck` writes a machine-specific `tsconfig.json` (gitignored) that maps `@adsk/fusion` to the local
Fusion install. `@adsk/fusion` is not on npm. VS Code uses the same file for IntelliSense.

## 2. Fusion integration tests (manual)

Code that passes `tsc` and Node can still fail inside Fusion: its TypeScript runtime isn't Node
(see `internal notes`). After changing anything under `DesignLint/src/analyzer/` or `DesignLint/src/ui/`,
or `DesignLint/resources/`, stop and run the add-in in Fusion and check:

- [ ] Add-in starts; **Analyze Design** appears in the Design workspace (Utilities → ADD-INS).
- [ ] Analyze an empty new design: the palette opens with no findings and no inspection notice.
- [ ] Analyze a real parametric design with sketches, features and joints: counts look right, timing is reasonable,
      and the "could not be inspected" notice is absent (or explained).
- [ ] Analyze an assembly with external references: external components are counted but not inspected, with no failures.
- [ ] **Locate** a root sketch, a sketch in a sub-component, a feature and a joint. Failures should show as a toast, never a dialog.
- [ ] Switch documents, then **Locate** again. It should refuse ("results belong to another document").
- [ ] **Re-analyze** keeps the severity/search filters. With another document active, it analyzes that document.
- [ ] **Copy** and **Copy all (TSV)** paste correctly.
- [ ] TEXT COMMANDS shows only diagnostics (start/stop, one line per analysis).
- [ ] Stop the add-in: the button and the palette disappear.

Known pitfalls that only show up in Fusion: `instanceof` on API classes, `localeCompare`/`Intl`, `Palettes.add` with
an HTML string, `entityToken` on some proxies, and `Selections.add` rejecting some joints.
