// Builders for plain DesignModel fixtures. Defaults describe a clean, healthy, well-named design;
// tests override only what their case is about. These are plain data, not Fusion API objects.

import {
    BodyInfo,
    ComponentInfo,
    DesignModel,
    ModelParameterInfo,
    SketchInfo,
    TimelineItemInfo,
    UnconstrainedEntityCounts,
    UserParameterInfo,
} from "../../DesignLint/src/models/DesignModel";

export function component(overrides: Partial<ComponentInfo> = {}): ComponentInfo {
    return {
        name: "Frame",
        entityToken: "token:component:Frame",
        isRoot: false,
        isExternal: false,
        bodyCount: 0,
        sketchCount: 0,
        featureCount: 0,
        modelParameterCount: 0,
        ...overrides,
    };
}

export function body(overrides: Partial<BodyInfo> = {}): BodyInfo {
    return {
        name: "Base plate",
        entityToken: "token:body:Base plate",
        componentName: "Frame",
        isSolid: true,
        isVisible: true,
        ...overrides,
    };
}

export function sketch(overrides: Partial<SketchInfo> = {}): SketchInfo {
    const name = overrides.name ?? "Base profile";
    return {
        name,
        entityToken: `token:sketch:${name}`,
        componentName: "Frame",
        isFullyConstrained: true,
        unconstrainedEntities: null,
        healthState: "healthy",
        healthMessage: "",
        ...overrides,
    };
}

export function unconstrained(
    curves: [unconstrained: number, total: number],
    points: [unconstrained: number, total: number],
    texts: [unconstrained: number, total: number] = [0, 0],
): UnconstrainedEntityCounts {
    return {
        curves: { unconstrained: curves[0], total: curves[1] },
        points: { unconstrained: points[0], total: points[1] },
        texts: { unconstrained: texts[0], total: texts[1] },
    };
}

export function timelineItem(overrides: Partial<TimelineItemInfo> = {}): TimelineItemInfo {
    const name = overrides.name ?? "Base extrude";
    return {
        name,
        entityToken: `token:timeline:${name}`,
        entityType: "ExtrudeFeature",
        componentName: "Frame",
        groupName: null,
        healthState: "healthy",
        healthMessage: "",
        ...overrides,
    };
}

/** A hard-coded length parameter; `mm` is the value in millimeters (stored internally in cm). */
export function lengthParameter(ownerName: string, mm: number, overrides: Partial<ModelParameterInfo> = {}): ModelParameterInfo {
    return {
        name: `d_${ownerName}_${mm}`,
        componentName: "Frame",
        role: "Depth",
        ownerName,
        ownerType: "ExtrudeFeature",
        ownerEntityToken: `token:owner:${ownerName}`,
        expression: `${mm} mm`,
        unit: "mm",
        value: mm / 10,
        displayValue: `${mm.toFixed(2)} mm`,
        isHardCoded: true,
        ...overrides,
    };
}

export function userParameter(overrides: Partial<UserParameterInfo> = {}): UserParameterInfo {
    return { name: "Thickness", expression: "2.5 mm", unit: "mm", value: 0.25, ...overrides };
}

/** A clean parametric design: one root component, a healthy constrained sketch, a named feature. */
export function model(overrides: Partial<DesignModel> = {}): DesignModel {
    return {
        documentName: "Bracket",
        designType: "parametric",
        designIntent: "part",
        components: [component({ name: "Bracket", isRoot: true, entityToken: null })],
        occurrenceCount: 0,
        bodies: [body()],
        sketches: [sketch()],
        userParameters: [],
        modelParameters: [lengthParameter("Base extrude", 12)],
        timelineItemCount: 2,
        timelineItems: [timelineItem({ name: "Base profile", entityType: "Sketch" }), timelineItem()],
        issues: [],
        ...overrides,
    };
}
