import { DesignIntentName, DesignTypeName } from "./DesignModel";

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
}
