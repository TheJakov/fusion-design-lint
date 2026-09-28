import { Finding } from "./Finding";
import { ModelSummary } from "./ModelSummary";

/** A rule that threw during evaluation. The other rules still ran. */
export interface RuleFailure {
    ruleId: string;
    message: string;
}

export interface AnalysisResult {
    summary: ModelSummary;
    findings: Finding[];
    ruleFailures: RuleFailure[];
}
