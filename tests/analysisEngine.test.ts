import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { analyzeModel } from "../DesignLint/src/analyzer/analysisEngine";
import { groupIssues, summarizeModel } from "../DesignLint/src/analyzer/modelSummary";
import { Rule } from "../DesignLint/src/rules/Rule";
import { ALL_RULES } from "../DesignLint/src/rules/ruleRegistry";
import { naturalCompare } from "../DesignLint/src/utils/text";
import { body, component, lengthParameter, model, sketch, timelineItem, unconstrained } from "./fixtures/models";

/** A design with something for every implemented rule. */
function mixedModel() {
    return model({
        components: [component({ name: "Trailer", isRoot: true }), component({ name: "Component2" })],
        bodies: [body({ name: "Body1" })],
        sketches: [
            sketch({ name: "Sketch20", isFullyConstrained: false, unconstrainedEntities: unconstrained([0, 5], [1, 13]) }),
            sketch({ name: "Sketch2", componentName: "Door wall", isFullyConstrained: false }),
            sketch({ name: "Profile", healthState: "error", healthMessage: "Lost reference" }),
        ],
        timelineItems: [timelineItem({ name: "Fillet3", entityType: "FilletFeature", healthState: "warning" })],
        modelParameters: ["Bottom", "Front", "Rigid 33"].map((o) => lengthParameter(o, 10)),
    });
}

describe("analysis engine", () => {
    test("clean model: no findings, no rule failures", () => {
        const result = analyzeModel(model(), ALL_RULES);
        assert.deepEqual(result.findings, []);
        assert.deepEqual(result.ruleFailures, []);
    });

    test("mixed model: every rule contributes, most severe first", () => {
        const { findings } = analyzeModel(mixedModel(), ALL_RULES);
        assert.deepEqual(
            findings.map((f) => `${f.severity} ${f.ruleId}`),
            [
                "critical sketch-health",
                "warning timeline-health",
                "warning sketch-under-constrained",
                "warning sketch-under-constrained",
                "info repeated-values",
                "info default-names", // Component2
                "info default-names", // Body1
                "info default-names", // Sketch2, Sketch20
                "info default-names", // Fillet3 (a default feature name too)
            ],
        );
    });

    test("output order does not depend on Fusion's collection order", () => {
        const forward = mixedModel();
        const reversed = { ...forward, sketches: [...forward.sketches].reverse(), components: [...forward.components].reverse() };
        const titles = (m: typeof forward) => analyzeModel(m, ALL_RULES).findings.map((f) => f.title + f.affectedObjects.map((o) => o.name));
        assert.deepEqual(titles(reversed), titles(forward));
    });

    test("a rule that throws is reported and the other rules still run", () => {
        const broken: Rule = {
            id: "broken",
            category: "feature",
            description: "always throws",
            evaluate() {
                throw new Error("boom");
            },
        };
        const result = analyzeModel(mixedModel(), [broken, ...ALL_RULES]);
        assert.deepEqual(result.ruleFailures, [{ ruleId: "broken", message: "boom" }]);
        assert.equal(result.findings.length, 9);
    });

    // Rule 5 (fragile references) is not implemented yet: the Fusion API data it needs
    // hasn't been verified. This placeholder keeps the brief's test case visible.
    test.todo("fragile reference: a sketch that depends on geometry from a later-modified feature");
});

describe("model summary", () => {
    test("counts local and external components, bodies, features and parameters", () => {
        const summary = summarizeModel(
            model({
                components: [
                    component({ isRoot: true, featureCount: 3, modelParameterCount: 5 }),
                    component({ featureCount: 2, modelParameterCount: 1 }),
                    component({ isExternal: true }),
                ],
                bodies: [body(), body({ isSolid: false })],
            }),
        );
        assert.equal(summary.componentCount, 2);
        assert.equal(summary.externalComponentCount, 1);
        assert.equal(summary.featureCount, 5);
        assert.equal(summary.modelParameterCount, 6);
        assert.equal(summary.solidBodyCount, 1);
        assert.equal(summary.surfaceBodyCount, 1);
    });

    test("groups extraction issues by message, largest group first, with a few examples", () => {
        const issues = [
            ...Array.from({ length: 5 }, (_, i) => ({ location: `token of timeline item ${i}`, message: "Tokens can only be created…" })),
            { location: "model parameters of Pin", message: "this is not a parametric design" },
        ];
        assert.deepEqual(groupIssues(issues), [
            { message: "Tokens can only be created…", count: 5, examples: ["token of timeline item 0", "token of timeline item 1", "token of timeline item 2"] },
            { message: "this is not a parametric design", count: 1, examples: ["model parameters of Pin"] },
        ]);
    });
});

describe("naturalCompare (ICU-free; Fusion's runtime lacks localeCompare options)", () => {
    test("numbers compare numerically", () => {
        const names = ["Sketch20", "Sketch2", "Sketch10", "Body1", "Sketch02"];
        assert.deepEqual([...names].sort(naturalCompare), ["Body1", "Sketch2", "Sketch02", "Sketch10", "Sketch20"]);
    });

    test("result does not depend on input order", () => {
        const names = ["b2", "a10", "a2", "", "A1"];
        assert.deepEqual([...names].reverse().sort(naturalCompare), [...names].sort(naturalCompare));
    });
});
