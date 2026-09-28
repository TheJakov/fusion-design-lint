// Pure: builds a ModelSummary from a DesignModel. No Fusion API access.

import { DesignModel, ExtractionIssue } from "../models/DesignModel";
import { IssueGroup, ModelSummary } from "../models/ModelSummary";

const MAX_ISSUE_EXAMPLES = 3;

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
        issueGroups: groupIssues(model.issues),
    };
}

/** Groups extraction issues by message, largest group first. */
export function groupIssues(issues: ExtractionIssue[]): IssueGroup[] {
    const byMessage = new Map<string, IssueGroup>();
    for (const issue of issues) {
        const group = byMessage.get(issue.message) ?? { message: issue.message, count: 0, examples: [] };
        group.count++;
        if (group.examples.length < MAX_ISSUE_EXAMPLES) {
            group.examples.push(issue.location);
        }
        byMessage.set(issue.message, group);
    }
    return [...byMessage.values()].sort((a, b) => b.count - a.count);
}
