// Pure: builds a ModelSummary from a DesignModel. No Fusion API access.

import { DesignModel } from "../models/DesignModel";
import { ModelSummary } from "../models/ModelSummary";

export function summarizeModel(model: DesignModel): ModelSummary {
    let featureCount = 0;
    let modelParameterCount = 0;
    let externalComponentCount = 0;
    for (const component of model.components) {
        if (component.isExternal) {
            externalComponentCount++;
        }
        featureCount += component.featureCount;
        modelParameterCount += component.modelParameterCount;
    }

    let solidBodyCount = 0;
    for (const body of model.bodies) {
        if (body.isSolid) {
            solidBodyCount++;
        }
    }

    return {
        documentName: model.documentName,
        designType: model.designType,
        designIntent: model.designIntent,
        componentCount: model.components.length - externalComponentCount,
        externalComponentCount,
        occurrenceCount: model.occurrenceCount,
        bodyCount: model.bodies.length,
        solidBodyCount,
        surfaceBodyCount: model.bodies.length - solidBodyCount,
        sketchCount: model.sketches.length,
        featureCount,
        userParameterCount: model.userParameters.length,
        modelParameterCount,
        timelineItemCount: model.timelineItemCount,
        issueCount: model.issues.length,
    };
}
