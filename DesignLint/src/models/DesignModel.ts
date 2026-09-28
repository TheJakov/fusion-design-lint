// Normalized, Fusion-independent representation of a design.
// Produced by analyzer/modelExtractor.ts; consumed by analysis code that must not touch the Fusion API.

export type DesignTypeName = "parametric" | "direct" | "unknown";
export type DesignIntentName = "part" | "assembly" | "hybrid" | "unknown";

export interface ComponentInfo {
    name: string;
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
    componentName: string;
    isSolid: boolean;
    isVisible: boolean;
}

export interface SketchInfo {
    name: string;
    componentName: string;
}

export interface UserParameterInfo {
    name: string;
    expression: string;
    unit: string;
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
    /** Null when the design has no timeline (direct modeling). */
    timelineItemCount: number | null;
    issues: ExtractionIssue[];
}
