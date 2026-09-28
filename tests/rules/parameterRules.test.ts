import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { repeatedValuesRule } from "../../DesignLint/src/rules/parameterRules";
import { lengthParameter, model, userParameter } from "../fixtures/models";

describe("repeated-values", () => {
    test("clean model: no findings", () => {
        assert.deepEqual(repeatedValuesRule.evaluate(model()), []);
    });

    test("reports a hard-coded value in at least 3 distinct owners, counting each owner once", () => {
        const m = model({
            modelParameters: [
                lengthParameter("Extrude1", 2.5),
                lengthParameter("Extrude1", 2.5, { role: "Taper" }), // same owner twice
                lengthParameter("Sketch2", 2.5, { ownerType: "SketchLinearDimension", componentName: "Door wall" }),
                lengthParameter("Fillet4", 2.5),
            ],
        });
        const [finding, ...rest] = repeatedValuesRule.evaluate(m);
        assert.equal(rest.length, 0);
        assert.equal(finding.severity, "info");
        assert.equal(finding.category, "parameter");
        assert.equal(finding.title, "Repeated hard-coded value: 2.50 mm");
        assert.deepEqual(
            finding.affectedObjects.map((o) => o.name),
            ["Extrude1 (Frame)", "Fillet4 (Frame)", "Sketch2 (Door wall)"],
        );
        assert.equal(finding.affectedObjects[0].entityToken, "token:owner:Extrude1");
        assert.match(finding.description, /4 time\(s\) across 3 model elements/);
        assert.match(finding.description, /may represent design intent/);
    });

    test("fewer than 3 owners is not reported", () => {
        const m = model({ modelParameters: [lengthParameter("A", 12), lengthParameter("B", 12)] });
        assert.deepEqual(repeatedValuesRule.evaluate(m), []);
    });

    test("ignores zero, unitless and parameter-driven values", () => {
        const m = model({
            modelParameters: [
                ...["J1", "J2", "J3"].map((o) => lengthParameter(o, 0)),
                ...["P1", "P2", "P3"].map((o) => lengthParameter(o, 4, { unit: "", value: 4 })),
                ...["E1", "E2", "E3"].map((o) => lengthParameter(o, 30, { isHardCoded: false })),
            ],
        });
        assert.deepEqual(repeatedValuesRule.evaluate(m), []);
    });

    test("groups the same physical value entered in different units", () => {
        const m = model({
            modelParameters: [
                lengthParameter("A", 2.5),
                lengthParameter("B", 2.5, { unit: "cm" }),
                lengthParameter("C", 90, { unit: "deg", value: Math.PI / 2 }),
                lengthParameter("D", 90, { unit: "rad", value: Math.PI / 2 }),
                lengthParameter("E", 90, { unit: "deg", value: Math.PI / 2 }),
            ],
        });
        const findings = repeatedValuesRule.evaluate(m);
        assert.equal(findings.length, 1); // 2.5 mm has only 2 owners; 90° has 3 across deg/rad
        assert.deepEqual(
            findings[0].affectedObjects.map((o) => o.name),
            ["C (Frame)", "D (Frame)", "E (Frame)"],
        );
    });

    test("names a user parameter with the same value", () => {
        const m = model({
            userParameters: [userParameter({ name: "Wall", value: 0.25 })],
            modelParameters: ["A", "B", "C"].map((o) => lengthParameter(o, 2.5)),
        });
        assert.match(repeatedValuesRule.evaluate(m)[0].description, /User parameter Wall has the same value/);
    });
});
