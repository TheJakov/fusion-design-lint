// Organization rules: maintainability suggestions, never engineering errors.

import {
    CONSTRUCTION_TYPE_PREFIX,
    DEFAULT_NAME_BASES,
    ENTITY_TYPES,
    FEATURE_TYPE_SUFFIX,
    JOINT_ENTITY_TYPES,
    RULE_IDS,
} from "../constants";
import { TimelineItemInfo } from "../models/DesignModel";
import { AffectedObject, Finding } from "../models/Finding";
import { naturalCompare } from "../utils/text";
import { Rule } from "./Rule";

/** "Rectangular Pattern3 (1)" -> "rectangularpattern3" */
function normalizeName(name: string): string {
    return name
        .replace(/\s*\(\d+\)$/, "")
        .replace(/[\s\-_]/g, "")
        .toLowerCase();
}

/** True when the name is one of the bases followed by digits, e.g. "Sketch12" for base "sketch". */
export function isDefaultName(name: string, bases: readonly string[]): boolean {
    const normalized = normalizeName(name);
    const match = /^(.*?)(\d+)$/.exec(normalized);
    return match !== null && bases.includes(match[1]);
}

/** "ExtrudeFeature" -> "extrude"; "Joint" -> "joint". */
function typeBase(entityType: string): string {
    const base = entityType.endsWith(FEATURE_TYPE_SUFFIX)
        ? entityType.slice(0, -FEATURE_TYPE_SUFFIX.length)
        : entityType;
    return base.toLowerCase();
}

type TimelineKind = "feature" | "construction" | "joint";

/**
 * Which default-names group a timeline item belongs to, or null if its name isn't a default name.
 * Items without an API type are classified by the base their name matches.
 */
function defaultNameKind(item: TimelineItemInfo): TimelineKind | null {
    const own = item.entityType ? [typeBase(item.entityType)] : [];
    if (item.entityType && JOINT_ENTITY_TYPES.includes(item.entityType)) {
        return isDefaultName(item.name, [...own, ...DEFAULT_NAME_BASES.joint]) ? "joint" : null;
    }
    if (item.entityType?.startsWith(CONSTRUCTION_TYPE_PREFIX)) {
        return isDefaultName(item.name, [...own, ...DEFAULT_NAME_BASES.construction]) ? "construction" : null;
    }
    if (item.entityType) {
        return isDefaultName(item.name, own) ? "feature" : null;
    }
    if (isDefaultName(item.name, DEFAULT_NAME_BASES.joint)) {
        return "joint";
    }
    return isDefaultName(item.name, DEFAULT_NAME_BASES.construction) ? "construction" : null;
}

function timelineObjects(model: { timelineItems: TimelineItemInfo[] }, kind: TimelineKind): AffectedObject[] {
    return model.timelineItems
        .filter((item) => item.entityType !== ENTITY_TYPES.sketch) // sketches come from model.sketches
        .filter((item) => defaultNameKind(item) === kind)
        .map((item) => ({
            name: item.componentName ? `${item.name} (${item.componentName})` : item.name,
            entityToken: item.entityToken,
        }));
}

interface NameGroup {
    /** Labels, e.g. ["sketch", "sketches"]. */
    kind: readonly [singular: string, plural: string];
    objects: AffectedObject[];
}

export const defaultNamesRule: Rule = {
    id: RULE_IDS.defaultNames,
    category: "organization",
    description: "Objects that still have the name Fusion generated (Sketch3, Body1, Extrude7, ...).",
    evaluate(model) {
        const groups: NameGroup[] = [
            {
                kind: ["component", "components"],
                objects: model.components
                    .filter((c) => !c.isRoot && !c.isExternal && isDefaultName(c.name, DEFAULT_NAME_BASES.component))
                    .map((c) => ({ name: c.name, entityToken: c.entityToken })),
            },
            {
                kind: ["body", "bodies"],
                objects: model.bodies
                    .filter((b) => isDefaultName(b.name, DEFAULT_NAME_BASES.body))
                    .map((b) => ({ name: `${b.name} (${b.componentName})`, entityToken: b.entityToken })),
            },
            {
                kind: ["sketch", "sketches"],
                objects: model.sketches
                    .filter((s) => isDefaultName(s.name, DEFAULT_NAME_BASES.sketch))
                    .map((s) => ({ name: `${s.name} (${s.componentName})`, entityToken: s.entityToken })),
            },
            { kind: ["feature", "features"], objects: timelineObjects(model, "feature") },
            {
                kind: ["construction geometry item", "construction geometry items"],
                objects: timelineObjects(model, "construction"),
            },
            { kind: ["joint", "joints"], objects: timelineObjects(model, "joint") },
        ];

        const findings: Finding[] = [];
        for (const group of groups) {
            if (group.objects.length === 0) {
                continue;
            }
            const count = group.objects.length;
            const label = count === 1 ? group.kind[0] : group.kind[1];
            findings.push({
                id: `${RULE_IDS.defaultNames}:${findings.length}`,
                severity: "info",
                category: "organization",
                title: `${count} ${label} with ${count === 1 ? "a default name" : "default names"}`,
                description:
                    `${count} ${label} ${count === 1 ? "still has" : "still have"} the name Fusion generated. ` +
                    "Descriptive names make the browser and timeline easier to navigate and changes easier to review. " +
                    "This is a maintainability suggestion, not an engineering error.",
                affectedObjects: [...group.objects].sort((a, b) => naturalCompare(a.name, b.name)),
                ruleId: RULE_IDS.defaultNames,
                canAutoFix: false,
            });
        }
        return findings;
    },
};
