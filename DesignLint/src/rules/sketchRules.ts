// Sketch rules. Both rely only on state Fusion itself reports; DesignLint does no constraint solving.

import { RULE_IDS } from "../constants";
import { SketchInfo } from "../models/DesignModel";
import { AffectedObject, Finding } from "../models/Finding";
import { Rule } from "./Rule";

function sketchObject(sketch: SketchInfo): AffectedObject {
    return { name: `${sketch.name} (${sketch.componentName})`, entityToken: sketch.entityToken };
}

/** Suppressed and rolled-back sketches aren't computed, so their state isn't meaningful. */
function isComputed(sketch: SketchInfo): boolean {
    return sketch.healthState !== "suppressed" && sketch.healthState !== "rolledBack";
}

/**
 * e.g. " Not fully constrained: 3 of 12 points, 1 of 40 curves."
 * Fusion can report a sketch as not fully constrained while every entity reports constrained;
 * in that case say so rather than print "0 of N".
 */
function describeUnconstrainedEntities(sketch: SketchInfo): string {
    const counts = sketch.unconstrainedEntities;
    if (!counts) {
        return "";
    }
    const parts: string[] = [];
    for (const [label, count] of [
        ["curves", counts.curves],
        ["points", counts.points],
        ["texts", counts.texts],
    ] as const) {
        if (count.unconstrained > 0) {
            parts.push(`${count.unconstrained} of ${count.total} ${label}`);
        }
    }
    return parts.length > 0
        ? ` Not fully constrained: ${parts.join(", ")}.`
        : " Fusion's per-entity data does not identify which geometry is free.";
}

export const sketchUnderConstrainedRule: Rule = {
    id: RULE_IDS.sketchUnderConstrained,
    category: "sketch",
    description: "Sketches that Fusion reports as not fully constrained.",
    evaluate(model) {
        const findings: Finding[] = [];
        for (const sketch of model.sketches) {
            if (sketch.isFullyConstrained !== false || !isComputed(sketch)) {
                continue;
            }
            const detail = describeUnconstrainedEntities(sketch);
            findings.push({
                id: `${RULE_IDS.sketchUnderConstrained}:${findings.length}`,
                severity: "warning",
                category: "sketch",
                title: "Potentially under-constrained sketch",
                description:
                    `Fusion reports that ${sketch.name} in ${sketch.componentName} is not fully constrained.${detail} ` +
                    "Unconstrained geometry can move unexpectedly when dimensions or referenced geometry change.",
                affectedObjects: [sketchObject(sketch)],
                ruleId: RULE_IDS.sketchUnderConstrained,
                canAutoFix: false,
            });
        }
        return findings;
    },
};

export const sketchHealthRule: Rule = {
    id: RULE_IDS.sketchHealth,
    category: "sketch",
    description: "Sketches that Fusion reports with an error or warning.",
    evaluate(model) {
        const findings: Finding[] = [];
        for (const sketch of model.sketches) {
            if (sketch.healthState !== "error" && sketch.healthState !== "warning") {
                continue;
            }
            const isError = sketch.healthState === "error";
            const fusionMessage = sketch.healthMessage ? ` Fusion's message: "${sketch.healthMessage}"` : "";
            findings.push({
                id: `${RULE_IDS.sketchHealth}:${findings.length}`,
                severity: isError ? "critical" : "warning",
                category: "sketch",
                title: isError ? "Sketch has an error in Fusion" : "Sketch has a warning in Fusion",
                description: `Fusion reports ${isError ? "an error" : "a warning"} on ${sketch.name} in ${sketch.componentName}.${fusionMessage}`,
                affectedObjects: [sketchObject(sketch)],
                ruleId: RULE_IDS.sketchHealth,
                canAutoFix: false,
            });
        }
        return findings;
    },
};
