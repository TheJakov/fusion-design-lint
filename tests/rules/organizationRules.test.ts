import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { defaultNamesRule, isDefaultName } from "../../DesignLint/src/rules/organizationRules";
import { body, component, model, sketch, timelineItem } from "../fixtures/models";

describe("isDefaultName", () => {
    const cases: [name: string, bases: string[], expected: boolean][] = [
        ["Sketch12", ["sketch"], true],
        ["Sketch 3", ["sketch"], true],
        ["Sketch1 (1)", ["sketch"], true], // copy/paste suffix
        ["Rectangular Pattern3", ["rectangularpattern"], true],
        ["As-built Joint1", ["asbuiltjoint"], true],
        ["Rigid 33", ["rigid"], true],
        ["sketch", ["sketch"], false], // no number
        ["Front", ["sketch"], false],
        ["Sketch2 Door", ["sketch"], false],
        ["Bracket 2", ["component"], false],
    ];
    for (const [name, bases, expected] of cases) {
        test(`${JSON.stringify(name)} with ${bases.join("/")} -> ${expected}`, () => {
            assert.equal(isDefaultName(name, bases), expected);
        });
    }
});

describe("default-names", () => {
    test("clean model: no findings", () => {
        assert.deepEqual(defaultNamesRule.evaluate(model()), []);
    });

    test("one info finding per kind, names sorted naturally, tokens kept for Locate", () => {
        const m = model({
            components: [
                component({ name: "Bracket", isRoot: true }),
                component({ name: "Component3" }),
                component({ name: "Component9", isExternal: true }), // another document: not ours to rename
            ],
            bodies: [body({ name: "Body2", componentName: "Door wall" }), body({ name: "Floor plate" })],
            sketches: [sketch({ name: "Sketch10" }), sketch({ name: "Sketch2" }), sketch({ name: "Front" })],
            timelineItems: [],
        });
        const findings = defaultNamesRule.evaluate(m);
        assert.ok(findings.every((f) => f.severity === "info" && f.category === "organization"));
        assert.deepEqual(
            findings.map((f) => [f.title, f.affectedObjects.map((o) => o.name)]),
            [
                ["1 component with a default name", ["Component3"]],
                ["1 body with a default name", ["Body2 (Door wall)"]],
                ["2 sketches with default names", ["Sketch2 (Frame)", "Sketch10 (Frame)"]],
            ],
        );
        assert.equal(findings[2].affectedObjects[0].entityToken, "token:sketch:Sketch2");
    });

    test("timeline items are split into features, construction geometry and joints", () => {
        const m = model({
            sketches: [],
            timelineItems: [
                timelineItem({ name: "Extrude7", entityType: "ExtrudeFeature" }),
                timelineItem({ name: "Floor cut", entityType: "ExtrudeFeature" }),
                timelineItem({ name: "Plane1", entityType: "ConstructionPlane" }),
                timelineItem({ name: "Mid plane", entityType: "ConstructionPlane" }),
                timelineItem({ name: "Rigid 33", entityType: "Joint" }),
                timelineItem({ name: "Revolute 14", entityType: "Joint" }),
                timelineItem({ name: "Hinge", entityType: "Joint" }),
                timelineItem({ name: "Rigid Group1", entityType: "RigidGroup" }),
                timelineItem({ name: "Sketch4", entityType: "Sketch" }), // reported via model.sketches
                timelineItem({ name: "Component Insert Frame:1", entityType: "Occurrence" }),
            ],
        });
        const byTitle = Object.fromEntries(
            defaultNamesRule.evaluate(m).map((f) => [f.title, f.affectedObjects.map((o) => o.name.replace(" (Frame)", ""))]),
        );
        assert.deepEqual(byTitle, {
            "1 feature with a default name": ["Extrude7"],
            "1 construction geometry item with a default name": ["Plane1"],
            "3 joints with default names": ["Revolute 14", "Rigid 33", "Rigid Group1"],
        });
    });
});
