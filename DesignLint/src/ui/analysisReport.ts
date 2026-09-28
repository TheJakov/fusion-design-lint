// Pure: formats an AnalysisResult as plain text for the message box shown when the findings
// palette can't be created (fallback only).

import { PRODUCT_NAME } from "../constants";
import { AnalysisResult } from "../models/AnalysisResult";
import { Finding, Severity } from "../models/Finding";

/** Keeps the fallback message box readable. */
const MAX_FINDINGS_IN_DIALOG = 10;
const MAX_OBJECTS_PER_FINDING_IN_DIALOG = 5;

const SEVERITY_LABELS: Record<Severity, string> = {
    critical: "Critical",
    warning: "Warning",
    info: "Info",
};

export function formatAnalysisReport(result: AnalysisResult, elapsedMs: number): string {
    const { summary, findings } = result;
    const lines = [
        `${PRODUCT_NAME} — ${summary.documentName}`,
        `Design: ${summary.designType}, ${summary.designIntent}`,
        "",
        "MODEL",
        `Components: ${summary.componentCount} (+${summary.externalComponentCount} external, not inspected)`,
        `Occurrences: ${summary.occurrenceCount}`,
        `Bodies: ${summary.bodyCount} (${summary.solidBodyCount} solid, ${summary.surfaceBodyCount} surface)`,
        `Sketches: ${summary.sketchCount}`,
        `Features: ${summary.featureCount}`,
        `Timeline items: ${summary.timelineItemCount ?? "n/a (direct modeling)"}`,
        `User parameters: ${summary.userParameterCount}`,
        `Model parameters: ${summary.modelParameterCount}`,
        "",
        "FINDINGS",
        `Critical: ${countBySeverity(findings, "critical")}   Warning: ${countBySeverity(findings, "warning")}   Info: ${countBySeverity(findings, "info")}`,
    ];

    if (findings.length === 0) {
        lines.push("No findings.");
    } else {
        lines.push("");
        for (const finding of findings.slice(0, MAX_FINDINGS_IN_DIALOG)) {
            lines.push(formatFindingLine(finding));
        }
        if (findings.length > MAX_FINDINGS_IN_DIALOG) {
            lines.push(`…and ${findings.length - MAX_FINDINGS_IN_DIALOG} more (the findings palette could not be opened to show all).`);
        }
    }

    lines.push("", `Analysis complete in ${formatDuration(elapsedMs)}.`);
    if (summary.issueCount > 0) {
        lines.push(`${summary.issueCount} element(s) could not be inspected; see the TEXT COMMAND window.`);
    }
    if (result.ruleFailures.length > 0) {
        lines.push(`${result.ruleFailures.length} rule(s) failed to run; see the TEXT COMMAND window.`);
    }
    return lines.join("\n");
}

function formatFindingLine(finding: Finding, maxObjects = MAX_OBJECTS_PER_FINDING_IN_DIALOG): string {
    const shown = finding.affectedObjects.slice(0, maxObjects).map((o) => o.name);
    const hidden = finding.affectedObjects.length - shown.length;
    const objects = shown.join(", ") + (hidden > 0 ? `, +${hidden} more` : "");
    return `[${SEVERITY_LABELS[finding.severity]}] ${finding.title}: ${objects}`;
}

function countBySeverity(findings: Finding[], severity: Severity): number {
    return findings.filter((f) => f.severity === severity).length;
}

function formatDuration(ms: number): string {
    return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} seconds`;
}
