// Normalized, Fusion-independent representation of a design.
// Produced by analyzer/modelExtractor.ts; consumed by analysis code that must not touch the Fusion API.

export type DesignTypeName = "parametric" | "direct" | "unknown";
export type DesignIntentName = "part" | "assembly" | "hybrid" | "unknown";
/** Mirrors Fusion's FeatureHealthStates. */
export type HealthState = "healthy" | "warning" | "error" | "suppressed" | "rolledBack" | "unknown";

export interface ComponentInfo {
    name: string;
    /** Fusion entity token for locating the object later (Design.findEntityByToken); null if unavailable. */
    entityToken: string | null;
    isRoot: boolean;
    /** Externally referenced (lives in another document). Its contents are not inspected; counts are 0. */
    isExternal: boolean;
    bodyCount: number;
    sketchCount: number;
    featureCount: number;
    modelParameterCount: number;
}

export interface BodyInfo {
    name: string;
    /** Fusion entity token for locating the object later (Design.findEntityByToken); null if unavailable. */
    entityToken: string | null;
    componentName: string;
    isSolid: boolean;
    isVisible: boolean;
}

export interface EntityCount {
    total: number;
    unconstrained: number;
}

export interface UnconstrainedEntityCounts {
    curves: EntityCount;
    points: EntityCount;
    texts: EntityCount;
}

export interface SketchInfo {
    name: string;
    /** Fusion entity token for locating the object later (Design.findEntityByToken); null if unavailable. */
    entityToken: string | null;
    componentName: string;
    /** Null if Fusion could not report it. */
    isFullyConstrained: boolean | null;
    /**
     * Per-entity constraint detail, only collected when the sketch is not fully constrained (null otherwise).
     * Fusion exposes no degree-of-freedom count; SketchEntity.isFullyConstrained is the closest detail.
     */
    unconstrainedEntities: UnconstrainedEntityCounts | null;
    healthState: HealthState;
    /** Fusion's message when healthState is "warning" or "error"; otherwise empty. */
    healthMessage: string;
}

/** A feature, joint, sketch, etc. in the design timeline (group rows excluded). */
export interface TimelineItemInfo {
    name: string;
    /** Fusion entity token for locating the object later (Design.findEntityByToken); null if unavailable. */
    entityToken: string | null;
    /** Fusion object type without namespace, e.g. "ExtrudeFeature"; null if Fusion exposes no API entity. */
    entityType: string | null;
    /** Owning component, when Fusion exposes it for this entity type (features, joints, construction geometry). */
    componentName: string | null;
    /** Name of the timeline group containing the item, if any. */
    groupName: string | null;
    healthState: HealthState;
    /** Fusion's message when healthState is "warning" or "error"; otherwise empty. */
    healthMessage: string;
}

export interface UserParameterInfo {
    name: string;
    expression: string;
    unit: string;
    /** Value in Fusion internal units (cm, radians); null for text parameters. */
    value: number | null;
}

/** A numeric model parameter: a value Fusion stores for a feature, sketch dimension, plane, joint, ... */
export interface ModelParameterInfo {
    name: string;
    componentName: string;
    /** What the value is for, e.g. "Depth", "Offset". */
    role: string;
    /** The object that created it, e.g. "Extrude3" or "Sketch2" (for a sketch dimension). */
    ownerName: string;
    /** Owner type without namespace, e.g. "ExtrudeFeature", "SketchLinearDimension". */
    ownerType: string;
    /** Entity token of the owner (the sketch, for sketch dimensions); null if unavailable. */
    ownerEntityToken: string | null;
    expression: string;
    unit: string;
    /** Value in Fusion internal units (cm, radians). */
    value: number;
    /** Value formatted by Fusion in the parameter's unit, e.g. "2.50 mm". */
    displayValue: string;
    /** True when the expression references no other parameter. */
    isHardCoded: boolean;
}

/** Something that could not be inspected. Extraction continues past these. */
export interface ExtractionIssue {
    location: string;
    message: string;
}

export interface DesignModel {
    documentName: string;
    designType: DesignTypeName;
    designIntent: DesignIntentName;
    /** Unique component definitions, including the root component and external components. */
    components: ComponentInfo[];
    /** Occurrences at any level of the assembly. */
    occurrenceCount: number;
    /** Bodies per component definition (not per occurrence). */
    bodies: BodyInfo[];
    sketches: SketchInfo[];
    userParameters: UserParameterInfo[];
    /** Numeric model parameters of local components (external components are not inspected). */
    modelParameters: ModelParameterInfo[];
    /** Null when the design has no timeline (direct modeling). */
    timelineItemCount: number | null;
    /** All timeline items, including those inside groups. Empty for direct modeling. */
    timelineItems: TimelineItemInfo[];
    issues: ExtractionIssue[];
}
