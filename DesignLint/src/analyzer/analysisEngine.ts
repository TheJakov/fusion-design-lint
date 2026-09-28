// Pure: runs rules over a DesignModel. No Fusion API access.

import { AnalysisResult, RuleFailure } from "../models/AnalysisResult";
import { DesignModel } from "../models/DesignModel";
import { Finding, SEVERITY_ORDER } from "../models/Finding";
import { Rule } from "../rules/Rule";
import { naturalCompare } from "../utils/text";
import { summarizeModel } from "./modelSummary";

export function analyzeModel(model: DesignModel, rules: readonly Rule[]): AnalysisResult {
    const findings: Finding[] = [];
    const ruleFailures: RuleFailure[] = [];
    for (const rule of rules) {
        try {
            findings.push(...rule.evaluate(model));
        } catch (err) {
            ruleFailures.push({ ruleId: rule.id, message: err instanceof Error ? err.message : String(err) });
        }
    }
    // Deterministic order: severity, then rule order, then affected object names.
    // Fusion does not guarantee collection order between runs, so model order alone isn't stable.
    const ruleOrder = new Map(rules.map((rule, i) => [rule.id, i]));
    findings.sort(
        (a, b) =>
            SEVERITY_ORDER.indexOf(a.severity) - SEVERITY_ORDER.indexOf(b.severity) ||
            (ruleOrder.get(a.ruleId) ?? 0) - (ruleOrder.get(b.ruleId) ?? 0) ||
            naturalCompare(objectNames(a), objectNames(b)),
    );
    return { summary: summarizeModel(model), findings, ruleFailures };
}

function objectNames(finding: Finding): string {
    return finding.affectedObjects.map((o) => o.name).join(", ");
}
