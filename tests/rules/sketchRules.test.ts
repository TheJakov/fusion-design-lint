import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { sketchHealthRule, sketchUnderConstrainedRule } from "../../DesignLint/src/rules/sketchRules";
import { model, sketch, unconstrained } from "../fixtures/models";

describe("sketch-under-constrained", () => {
    test("clean model: no findings", () => {
        assert.deepEqual(sketchUnderConstrainedRule.evaluate(model()), []);
    });

    test("reports a sketch Fusion says is not fully constrained, with per-entity detail", () => {
        const m = model({
            sketches: [
                sketch({ name: "Sketch2", componentName: "Door wall", isFullyConstrained: false, unconstrainedEntities: unconstrained([2, 21], [4, 23]) }),
            ],
        });
        const [finding, ...rest] = sketchUnderConstrainedRule.evaluate(m);
        assert.equal(rest.length, 0);
        assert.equal(finding.severity, "warning");
        assert.equal(finding.title, "Potentially under-constrained sketch");
        assert.deepEqual(finding.affectedObjects, [{ name: "Sketch2 (Door wall)", entityToken: "token:sketch:Sketch2" }]);
        assert.match(finding.description, /Not fully constrained: 2 of 21 curves, 4 of 23 points\./);
    });

    test("does not print a misleading 0-of-N when every entity reports constrained", () => {
        const m = model({ sketches: [sketch({ isFullyConstrained: false, unconstrainedEntities: unconstrained([0, 54], [0, 60]) })] });
        const [finding] = sketchUnderConstrainedRule.evaluate(m);
        assert.doesNotMatch(finding.description, /0 of/);
        assert.match(finding.description, /does not identify which geometry is free/);
    });

    test("skips sketches Fusion doesn't compute (suppressed, rolled back) and unknown constraint state", () => {
        const m = model({
            sketches: [
                sketch({ name: "A", isFullyConstrained: false, healthState: "rolledBack" }),
                sketch({ name: "B", isFullyConstrained: false, healthState: "suppressed" }),
                sketch({ name: "C", isFullyConstrained: null }),
            ],
        });
        assert.deepEqual(sketchUnderConstrainedRule.evaluate(m), []);
    });
});

describe("sketch-health", () => {
    test("error -> critical, warning -> warning, with Fusion's message", () => {
        const m = model({
            sketches: [
                sketch({ name: "Broken", healthState: "error", healthMessage: "Lost reference" }),
                sketch({ name: "Shaky", healthState: "warning", healthMessage: "Projection out of date" }),
                sketch({ name: "Fine" }),
            ],
        });
        const findings = sketchHealthRule.evaluate(m);
        assert.deepEqual(
            findings.map((f) => [f.affectedObjects[0].name, f.severity]),
            [
                ["Broken (Frame)", "critical"],
                ["Shaky (Frame)", "warning"],
            ],
        );
        assert.match(findings[0].description, /Fusion's message: "Lost reference"/);
    });
});
