import { DesignIntentName, DesignTypeName } from "./DesignModel";

/** Extraction failures that share the same error message. */
export interface IssueGroup {
    message: string;
    count: number;
    /** Up to a few locations, e.g. "token of timeline item Rigid 33". */
    examples: string[];
}

export interface ModelSummary {
    documentName: string;
    designType: DesignTypeName;
    designIntent: DesignIntentName;
    /** Components defined in this document, including the root. */
    componentCount: number;
    externalComponentCount: number;
    occurrenceCount: number;
    bodyCount: number;
    solidBodyCount: number;
    surfaceBodyCount: number;
    sketchCount: number;
    featureCount: number;
    userParameterCount: number;
    modelParameterCount: number;
    timelineItemCount: number | null;
    issueCount: number;
    issueGroups: IssueGroup[];
}
