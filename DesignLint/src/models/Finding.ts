// A single analysis result shown to the user.
//
// Severity follows the DesignLint philosophy:
// - critical: Fusion itself reports the object as invalid/failed.
// - warning:  something that may cause problems later.
// - info:     a maintainability/robustness suggestion.

export type Severity = "critical" | "warning" | "info";

export type FindingCategory = "sketch" | "parameter" | "reference" | "organization" | "feature" | "manufacturing";

export interface Finding {
    /** Unique within one analysis run. */
    id: string;
    severity: Severity;
    category: FindingCategory;
    title: string;
    description: string;
    /** Human-readable names of the affected objects, e.g. "Sketch3 (Frame)". */
    affectedObjects: string[];
    ruleId: string;
    canAutoFix: boolean;
}

export const SEVERITY_ORDER: readonly Severity[] = ["critical", "warning", "info"];
