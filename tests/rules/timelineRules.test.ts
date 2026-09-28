import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { timelineHealthRule } from "../../DesignLint/src/rules/timelineRules";
import { model, timelineItem } from "../fixtures/models";

describe("timeline-health", () => {
    test("clean model: no findings", () => {
        assert.deepEqual(timelineHealthRule.evaluate(model()), []);
    });

    test("reports features and joints Fusion flags, labelled with type, component and group", () => {
        const m = model({
            timelineItems: [
                timelineItem({ name: "Fillet3", entityType: "FilletFeature", healthState: "error", healthMessage: "Unable to create fillet" }),
                timelineItem({ name: "Hinge", entityType: "Joint", componentName: "01 Trailer", groupName: "Doors", healthState: "warning" }),
            ],
        });
        const [error, warning] = timelineHealthRule.evaluate(m);
        assert.equal(error.severity, "critical");
        assert.equal(error.affectedObjects[0].name, "Fillet3 (FilletFeature in Frame)");
        assert.match(error.description, /Fusion's message: "Unable to create fillet"/);
        assert.equal(warning.severity, "warning");
        assert.match(warning.description, /in timeline group Doors/);
    });

    test("leaves sketches to sketch-health and ignores rolled-back or suppressed items", () => {
        const m = model({
            timelineItems: [
                timelineItem({ name: "Sketch9", entityType: "Sketch", healthState: "error" }),
                timelineItem({ name: "Later", healthState: "rolledBack" }),
                timelineItem({ name: "Off", healthState: "suppressed" }),
            ],
        });
        assert.deepEqual(timelineHealthRule.evaluate(m), []);
    });
});
