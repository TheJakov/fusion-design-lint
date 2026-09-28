// Timeline rules. Report only what Fusion itself flags on timeline items (features, joints, etc.).

import { ENTITY_TYPES, RULE_IDS } from "../constants";
import { TimelineItemInfo } from "../models/DesignModel";
import { Finding } from "../models/Finding";
import { Rule } from "./Rule";

/** e.g. "Fillet3 (FilletFeature in Frame)" */
function itemLabel(item: TimelineItemInfo): string {
    const details = [item.entityType, item.componentName ? `in ${item.componentName}` : null].filter(Boolean).join(" ");
    return details ? `${item.name} (${details})` : item.name;
}

export const timelineHealthRule: Rule = {
    id: RULE_IDS.timelineHealth,
    category: "feature",
    description: "Timeline items (features, joints, etc.) that Fusion reports with an error or warning.",
    evaluate(model) {
        const findings: Finding[] = [];
        for (const item of model.timelineItems) {
            if (item.healthState !== "error" && item.healthState !== "warning") {
                continue;
            }
            // Sketches are reported by sketch-health.
            if (item.entityType === ENTITY_TYPES.sketch) {
                continue;
            }
            const isError = item.healthState === "error";
            const where = item.groupName ? ` in timeline group ${item.groupName}` : "";
            const fusionMessage = item.healthMessage ? ` Fusion's message: "${item.healthMessage}"` : "";
            findings.push({
                id: `${RULE_IDS.timelineHealth}:${findings.length}`,
                severity: isError ? "critical" : "warning",
                category: "feature",
                title: isError ? "Timeline item has an error in Fusion" : "Timeline item has a warning in Fusion",
                description: `Fusion reports ${isError ? "an error" : "a warning"} on ${itemLabel(item)}${where}.${fusionMessage}`,
                affectedObjects: [{ name: itemLabel(item), entityToken: item.entityToken }],
                ruleId: RULE_IDS.timelineHealth,
                canAutoFix: false,
            });
        }
        return findings;
    },
};
