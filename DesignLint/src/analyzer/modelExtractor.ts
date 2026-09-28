// Fusion API → DesignModel. The only analyzer module that touches the Fusion API.
// Each element is read in isolation: a failure is recorded as an ExtractionIssue and
// extraction continues with the rest of the design.

import { adsk } from "@adsk/fusion";
import {
    CONSTRUCTION_TYPE_PREFIX,
    DESIGN_INTENT_TYPES,
    ENTITY_TYPES,
    DESIGN_TYPES,
    FEATURE_HEALTH_STATES,
    PARAMETER_VALUE_TYPES,
} from "../constants";
import {
    BodyInfo,
    ComponentInfo,
    DesignIntentName,
    DesignModel,
    DesignTypeName,
    EntityCount,
    ExtractionIssue,
    HealthState,
    ModelParameterInfo,
    SketchInfo,
    TimelineItemInfo,
    UnconstrainedEntityCounts,
    UserParameterInfo,
} from "../models/DesignModel";
import { errorMessage, log } from "../utils/logging";
import { groupIssues } from "./modelSummary";

type Attempt = <T>(location: string, fn: () => T, fallback: T) => T;
/** Formats a value in internal units (cm, radians) for display in the given unit. */
type FormatValue = (value: number, unit: string) => string;

export function extractDesignModel(design: adsk.fusion.Design, documentName: string): DesignModel {
    const issues: ExtractionIssue[] = [];
    const attempt: Attempt = (location, fn, fallback) => {
        try {
            return fn();
        } catch (err) {
            const message = errorMessage(err);
            issues.push({ location, message });
            log(`Could not inspect ${location}: ${message}. Continuing analysis...`);
            return fallback;
        }
    };

    const designType = attempt("design type", () => toDesignTypeName(design.designType), "unknown");
    const designIntent = attempt("design intent", () => toDesignIntentName(design.designIntent), "unknown");

    const components: ComponentInfo[] = [];
    const bodies: BodyInfo[] = [];
    const sketches: SketchInfo[] = [];
    const root = attempt("root component", () => design.rootComponent, null);
    const { occurrenceCount, externalComponents } = scanOccurrences(root, attempt);

    const unitsManager = attempt("units manager", () => design.fusionUnitsManager, null);
    const formatValue: FormatValue = (value, unit) => {
        if (unitsManager && unit) {
            try {
                return unitsManager.formatInternalValue(value, unit, true);
            } catch {
                // Fall through to the raw value; formatting is display-only.
            }
        }
        return unit ? `${value} (internal units)` : String(value);
    };
    const modelParameters: ModelParameterInfo[] = [];

    const allComponents = attempt("components", () => design.allComponents, null);
    const componentCount = allComponents ? attempt("component count", () => allComponents.count, 0) : 0;
    for (let i = 0; i < componentCount; i++) {
        const component = attempt(`component #${i}`, () => allComponents!.item(i), null);
        if (!component) {
            continue;
        }
        if (externalComponents.has(component)) {
            components.push(describeExternalComponent(component, attempt));
        } else {
            components.push(
                extractComponent(component, component === root, bodies, sketches, modelParameters, formatValue, attempt),
            );
        }
    }

    const userParameters = extractUserParameters(design, attempt);


    // Direct-modeling designs have no timeline.
    const timeline = designType === "direct" ? null : attempt("timeline", () => design.timeline ?? null, null);
    const timelineItemCount = timeline ? attempt("timeline count", () => timeline.count, null) : null;
    const timelineItems = timeline ? extractTimelineItems(timeline, attempt) : [];

    logIssueSummary(issues);

    return {
        documentName,
        designType,
        designIntent,
        components,
        occurrenceCount,
        bodies,
        sketches,
        userParameters,
        modelParameters,
        timelineItemCount,
        timelineItems,
        issues,
    };
}

/**
 * Walks the occurrence tree once: counts occurrences and finds components that belong to
 * external references. Fusion flags only the top-level linked occurrence
 * (Occurrence.isReferencedComponent); occurrences nested inside it report false, so
 * everything below an external occurrence is treated as external too.
 */
function scanOccurrences(
    root: adsk.fusion.Component | null,
    attempt: Attempt,
): { occurrenceCount: number; externalComponents: Set<adsk.fusion.Component> } {
    const externalComponents = new Set<adsk.fusion.Component>();
    let occurrenceCount = 0;

    const stack: { list: adsk.fusion.Occurrences | adsk.fusion.OccurrenceList; insideExternal: boolean }[] = [];
    const topLevel = root ? attempt("occurrences", () => root.occurrences, null) : null;
    if (topLevel) {
        stack.push({ list: topLevel, insideExternal: false });
    }
    while (stack.length > 0) {
        const { list, insideExternal } = stack.pop()!;
        const count = attempt("occurrence count", () => list.count, 0);
        for (let i = 0; i < count; i++) {
            attempt(
                `occurrence #${i}`,
                () => {
                    const occ = list.item(i);
                    if (!occ) {
                        return;
                    }
                    occurrenceCount++;
                    const isExternal = insideExternal || occ.isReferencedComponent;
                    if (isExternal) {
                        externalComponents.add(occ.component);
                    }
                    stack.push({ list: occ.childOccurrences, insideExternal: isExternal });
                },
                undefined,
            );
        }
    }
    return { occurrenceCount, externalComponents };
}

function describeExternalComponent(component: adsk.fusion.Component, attempt: Attempt): ComponentInfo {
    return {
        name: attempt("external component name", () => component.name, "(unnamed component)"),
        entityToken: null,
        isRoot: false,
        isExternal: true,
        bodyCount: 0,
        sketchCount: 0,
        featureCount: 0,
        modelParameterCount: 0,
    };
}

/** One log line per distinct failure message. */
function logIssueSummary(issues: ExtractionIssue[]): void {
    if (issues.length === 0) {
        return;
    }
    log(`${issues.length} element(s) could not be inspected:`);
    for (const group of groupIssues(issues)) {
        const more = group.count > group.examples.length ? `; +${group.count - group.examples.length} more` : "";
        log(`  ${group.count}× "${group.message}" (${group.examples.join("; ")}${more})`);
    }
}

function extractComponent(
    component: adsk.fusion.Component,
    isRoot: boolean,
    bodies: BodyInfo[],
    sketches: SketchInfo[],
    modelParameters: ModelParameterInfo[],
    formatValue: FormatValue,
    attempt: Attempt,
): ComponentInfo {
    const name = attempt("component name", () => component.name, "(unnamed component)");

    const bodyCollection = attempt(`bodies of ${name}`, () => component.bRepBodies, null);
    const bodyCount = bodyCollection ? attempt(`body count of ${name}`, () => bodyCollection.count, 0) : 0;
    for (let i = 0; i < bodyCount; i++) {
        const body = attempt(
            `body #${i} of ${name}`,
            () => {
                const b = bodyCollection!.item(i);
                return b
                    ? {
                          name: b.name,
                          entityToken: entityTokenOf(b),
                          componentName: name,
                          isSolid: b.isSolid,
                          isVisible: b.isVisible,
                      }
                    : null;
            },
            null,
        );
        if (body) {
            bodies.push(body);
        }
    }

    const sketchCollection = attempt(`sketches of ${name}`, () => component.sketches, null);
    const sketchCount = sketchCollection ? attempt(`sketch count of ${name}`, () => sketchCollection.count, 0) : 0;
    for (let i = 0; i < sketchCount; i++) {
        const sketch = attempt(`sketch #${i} of ${name}`, () => sketchCollection!.item(i), null);
        if (sketch) {
            sketches.push(extractSketch(sketch, name, attempt));
        }
    }

    return {
        name,
        entityToken: entityTokenOf(component),
        isRoot,
        isExternal: false,
        bodyCount,
        sketchCount,
        featureCount: attempt(`features of ${name}`, () => component.features.count, 0),
        modelParameterCount: extractModelParameters(component, name, modelParameters, formatValue, attempt),
    };
}

/** Appends the component's numeric model parameters; returns the total parameter count. */
function extractModelParameters(
    component: adsk.fusion.Component,
    componentName: string,
    out: ModelParameterInfo[],
    formatValue: FormatValue,
    attempt: Attempt,
): number {
    const params = attempt(`model parameters of ${componentName}`, () => component.modelParameters, null);
    const count = params ? attempt(`model parameter count of ${componentName}`, () => params.count, 0) : 0;
    for (let i = 0; i < count; i++) {
        const info = attempt(
            `model parameter #${i} of ${componentName}`,
            () => {
                const p = params!.item(i);
                if (!p || p.valueType !== PARAMETER_VALUE_TYPES.numeric) {
                    return null;
                }
                const owner = describeParameterOwner(p.createdBy);
                return {
                    name: p.name,
                    componentName,
                    role: p.role,
                    ownerName: owner.name,
                    ownerType: owner.type,
                    ownerEntityToken: owner.entityToken,
                    expression: p.expression,
                    unit: p.unit,
                    value: p.value,
                    displayValue: formatValue(p.value, p.unit),
                    isHardCoded: p.dependencyParameters.count === 0,
                };
            },
            null,
        );
        if (info) {
            out.push(info);
        }
    }
    return count;
}

/**
 * ModelParameter.createdBy is a feature, sketch dimension, construction plane, joint, ...
 * Sketch dimensions are reported by their sketch (SketchDimension.parentSketch); everything else
 * by its own name.
 */
function describeParameterOwner(createdBy: adsk.core.Base | null): {
    name: string;
    type: string;
    entityToken: string | null;
} {
    const type = shortObjectType(createdBy) ?? "Unknown";
    if (!createdBy) {
        return { name: "(unknown owner)", type, entityToken: null };
    }
    const owner = createdBy as { parentSketch?: adsk.fusion.Sketch | null; name?: string };
    if (type.endsWith("Dimension") && owner.parentSketch) {
        return { name: owner.parentSketch.name, type, entityToken: entityTokenOf(owner.parentSketch) };
    }
    return {
        name: typeof owner.name === "string" ? owner.name : `(${type})`,
        type,
        entityToken: entityTokenOf(createdBy),
    };
}

/**
 * Best-effort entity token for Locate. Most Fusion entity classes have entityToken (core.Base does not),
 * and some throw for certain proxies. A missing token only means the object can't be located, so it is
 * not recorded as an extraction issue.
 */
function entityTokenOf(entity: object | null): string | null {
    try {
        const token = (entity as { entityToken?: unknown } | null)?.entityToken;
        return typeof token === "string" && token !== "" ? token : null;
    } catch {
        return null;
    }
}

function extractSketch(sketch: adsk.fusion.Sketch, componentName: string, attempt: Attempt): SketchInfo {
    const name = attempt(`sketch name in ${componentName}`, () => sketch.name, "(unnamed sketch)");
    const where = `sketch ${name} (${componentName})`;
    const isFullyConstrained = attempt(`constraint status of ${where}`, () => sketch.isFullyConstrained, null);
    const unconstrainedEntities =
        isFullyConstrained === false
            ? attempt(`entities of ${where}`, () => countUnconstrainedEntities(sketch), null)
            : null;
    return {
        name,
        entityToken: entityTokenOf(sketch),
        componentName,
        isFullyConstrained,
        unconstrainedEntities,
        healthState: attempt(`health of ${where}`, () => toHealthState(sketch.healthState), "unknown"),
        healthMessage: attempt(`health message of ${where}`, () => sketch.errorOrWarningMessage ?? "", ""),
    };
}

function countUnconstrainedEntities(sketch: adsk.fusion.Sketch): UnconstrainedEntityCounts {
    return {
        curves: countUnconstrained(sketch.sketchCurves),
        points: countUnconstrained(sketch.sketchPoints),
        texts: countUnconstrained(sketch.sketchTexts),
    };
}

function countUnconstrained(collection: {
    count: number;
    item(index: number): adsk.fusion.SketchEntity | null;
}): EntityCount {
    const total = collection.count;
    let unconstrained = 0;
    for (let i = 0; i < total; i++) {
        const entity = collection.item(i);
        if (entity && !entity.isFullyConstrained) {
            unconstrained++;
        }
    }
    return { total, unconstrained };
}

/**
 * Walks the timeline including group contents. A collapsed group's children are only reachable
 * through the group; group rows themselves are skipped (Fusion reports Unknown health for them).
 * `seen` guards against visiting an item twice (Fusion guarantees === identity for API objects).
 */
function extractTimelineItems(timeline: adsk.fusion.Timeline, attempt: Attempt): TimelineItemInfo[] {
    const result: TimelineItemInfo[] = [];
    const seen = new Set<adsk.fusion.TimelineObject>();

    const visit = (
        list: { count: number; item(index: number): adsk.fusion.TimelineObject | null },
        groupName: string | null,
    ): void => {
        const count = attempt(`timeline items${groupName ? ` in group ${groupName}` : ""}`, () => list.count, 0);
        for (let i = 0; i < count; i++) {
            const obj = attempt(`timeline item #${i}${groupName ? ` in group ${groupName}` : ""}`, () => list.item(i), null);
            if (!obj || seen.has(obj)) {
                continue;
            }
            seen.add(obj);
            if (attempt(`group flag of timeline item #${i}`, () => obj.isGroup, false)) {
                const group = obj as adsk.fusion.TimelineGroup;
                visit(group, attempt("timeline group name", () => group.name, "(unnamed group)"));
                continue;
            }
            result.push(extractTimelineItem(obj, groupName, attempt));
        }
    };

    visit(timeline, null);
    return result;
}

function extractTimelineItem(
    obj: adsk.fusion.TimelineObject,
    groupName: string | null,
    attempt: Attempt,
): TimelineItemInfo {
    const name = attempt("timeline item name", () => obj.name, "(unnamed timeline item)");
    const entity = attempt(`entity of timeline item ${name}`, () => obj.entity ?? null, null);
    const entityType = attempt(`type of timeline item ${name}`, () => shortObjectType(entity), null);
    return {
        name,
        // Occurrence entities in the timeline (component inserts, "Body->Comp") throw on entityToken
        // ("Tokens can only be created for proxies whose top-level parent is the root component")
        // and are never Locate targets, so skip them rather than pay for the exception.
        entityToken: entityType === ENTITY_TYPES.occurrence ? null : entityTokenOf(entity),
        entityType,
        componentName: attempt(`component of timeline item ${name}`, () => owningComponentName(entity, entityType), null),
        groupName,
        healthState: attempt(`health of timeline item ${name}`, () => toHealthState(obj.healthState), "unknown"),
        healthMessage: attempt(`health message of timeline item ${name}`, () => obj.errorOrWarningMessage ?? "", ""),
    };
}

/**
 * Features, joints and rigid groups expose Feature/Joint/RigidGroup.parentComponent; construction
 * geometry exposes ConstructionPlane/Axis/Point.component. Other types (e.g. Occurrence, whose
 * `component` is the referenced component, not the owner) return null.
 */
function owningComponentName(entity: adsk.core.Base | null, entityType: string | null): string | null {
    if (!entity || !entityType) {
        return null;
    }
    const owner = entity as { parentComponent?: adsk.fusion.Component | null; component?: adsk.fusion.Component | null };
    const component = entityType.startsWith(CONSTRUCTION_TYPE_PREFIX) ? owner.component : owner.parentComponent;
    return component ? component.name : null;
}

/** "adsk::fusion::ExtrudeFeature" -> "ExtrudeFeature"; null when there is no entity. */
function shortObjectType(entity: adsk.core.Base | null): string | null {
    if (!entity) {
        return null;
    }
    const full = entity.objectType;
    return full.slice(full.lastIndexOf("::") + 2);
}

function extractUserParameters(design: adsk.fusion.Design, attempt: Attempt): UserParameterInfo[] {
    const result: UserParameterInfo[] = [];
    const params = attempt("user parameters", () => design.userParameters, null);
    const count = params ? attempt("user parameter count", () => params.count, 0) : 0;
    for (let i = 0; i < count; i++) {
        const param = attempt(
            `user parameter #${i}`,
            () => {
                const p = params!.item(i);
                if (!p) {
                    return null;
                }
                const isNumeric = p.valueType === PARAMETER_VALUE_TYPES.numeric;
                return { name: p.name, expression: p.expression, unit: p.unit, value: isNumeric ? p.value : null };
            },
            null,
        );
        if (param) {
            result.push(param);
        }
    }
    return result;
}

function toDesignTypeName(value: number): DesignTypeName {
    switch (value) {
        case DESIGN_TYPES.parametric:
            return "parametric";
        case DESIGN_TYPES.direct:
            return "direct";
        default:
            return "unknown";
    }
}

function toDesignIntentName(value: number): DesignIntentName {
    switch (value) {
        case DESIGN_INTENT_TYPES.part:
            return "part";
        case DESIGN_INTENT_TYPES.assembly:
            return "assembly";
        case DESIGN_INTENT_TYPES.hybrid:
            return "hybrid";
        default:
            return "unknown";
    }
}

function toHealthState(value: number): HealthState {
    switch (value) {
        case FEATURE_HEALTH_STATES.healthy:
            return "healthy";
        case FEATURE_HEALTH_STATES.warning:
            return "warning";
        case FEATURE_HEALTH_STATES.error:
            return "error";
        case FEATURE_HEALTH_STATES.suppressed:
            return "suppressed";
        case FEATURE_HEALTH_STATES.rolledBack:
            return "rolledBack";
        default:
            return "unknown";
    }
}
