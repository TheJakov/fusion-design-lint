// Pure: formats a ModelSummary as plain text for a message box.
// Temporary until the findings UI (Step 5).

import { PRODUCT_NAME } from "../constants";
import { ModelSummary } from "../models/ModelSummary";

export function formatSummaryReport(summary: ModelSummary, elapsedMs: number): string {
    const lines = [
        `${PRODUCT_NAME} — Model summary`,
        "",
        `Document: ${summary.documentName}`,
        `Design: ${summary.designType}, ${summary.designIntent}`,
        "",
        `Components: ${summary.componentCount}`,
        `External components: ${summary.externalComponentCount} (not inspected; analyze them in their own documents)`,
        `Occurrences: ${summary.occurrenceCount}`,
        `Bodies: ${summary.bodyCount} (${summary.solidBodyCount} solid, ${summary.surfaceBodyCount} surface)`,
        `Sketches: ${summary.sketchCount}`,
        `Features: ${summary.featureCount}`,
        `Timeline items: ${summary.timelineItemCount ?? "n/a (direct modeling)"}`,
        `User parameters: ${summary.userParameterCount}`,
        `Model parameters: ${summary.modelParameterCount}`,
        "",
        `Analysis complete in ${formatDuration(elapsedMs)}.`,
    ];
    if (summary.issueCount > 0) {
        lines.push(`${summary.issueCount} element(s) could not be inspected; see the TEXT COMMAND window.`);
    }
    return lines.join("\n");
}

function formatDuration(ms: number): string {
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} seconds`;
}
