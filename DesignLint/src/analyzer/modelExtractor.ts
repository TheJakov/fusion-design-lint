// Fusion API → DesignModel. The only analyzer module that touches the Fusion API.
// Each element is read in isolation: a failure is recorded as an ExtractionIssue and
// extraction continues with the rest of the design.

import { adsk } from "@adsk/fusion";
import { DESIGN_INTENT_TYPES, DESIGN_TYPES } from "../constants";
import {
    BodyInfo,
    ComponentInfo,
    DesignIntentName,
    DesignModel,
    DesignTypeName,
    ExtractionIssue,
    SketchInfo,
    UserParameterInfo,
} from "../models/DesignModel";
import { errorMessage, log } from "../utils/logging";

type Attempt = <T>(location: string, fn: () => T, fallback: T) => T;

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
            components.push(extractComponent(component, component === root, bodies, sketches, attempt));
        }
    }

    const userParameters = extractUserParameters(design, attempt);

    // Direct-modeling designs have no timeline.
    const timelineItemCount =
        designType === "direct" ? null : attempt("timeline", () => design.timeline?.count ?? null, null);

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
        timelineItemCount,
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
        isRoot: false,
        isExternal: true,
        bodyCount: 0,
        sketchCount: 0,
        featureCount: 0,
        modelParameterCount: 0,
    };
}

/** Groups issues by message so repeated failures show up as one log line. */
function logIssueSummary(issues: ExtractionIssue[]): void {
    if (issues.length === 0) {
        return;
    }
    const byMessage = new Map<string, string[]>();
    for (const issue of issues) {
        const locations = byMessage.get(issue.message) ?? [];
        locations.push(issue.location);
        byMessage.set(issue.message, locations);
    }
    log(`${issues.length} element(s) could not be inspected:`);
    for (const [message, locations] of byMessage) {
        const examples = locations.slice(0, 3).join("; ");
        const more = locations.length > 3 ? `; +${locations.length - 3} more` : "";
        log(`  ${locations.length}× "${message}" (${examples}${more})`);
    }
}

function extractComponent(
    component: adsk.fusion.Component,
    isRoot: boolean,
    bodies: BodyInfo[],
    sketches: SketchInfo[],
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
                return b ? { name: b.name, componentName: name, isSolid: b.isSolid, isVisible: b.isVisible } : null;
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
        const sketch = attempt(
            `sketch #${i} of ${name}`,
            () => {
                const s = sketchCollection!.item(i);
                return s ? { name: s.name, componentName: name } : null;
            },
            null,
        );
        if (sketch) {
            sketches.push(sketch);
        }
    }

    return {
        name,
        isRoot,
        isExternal: false,
        bodyCount,
        sketchCount,
        featureCount: attempt(`features of ${name}`, () => component.features.count, 0),
        modelParameterCount: attempt(`model parameters of ${name}`, () => component.modelParameters.count, 0),
    };
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
                return p ? { name: p.name, expression: p.expression, unit: p.unit } : null;
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
