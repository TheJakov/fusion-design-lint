// A single analysis result shown to the user.
//
// Severity follows the DesignLint philosophy:
// - critical: Fusion itself reports the object as invalid/failed.
// - warning:  something that may cause problems later.
// - info:     a maintainability/robustness suggestion.

export type Severity = "critical" | "warning" | "info";

export type FindingCategory = "sketch" | "parameter" | "reference" | "organization" | "feature" | "manufacturing";

/** An object a finding refers to. */
export interface AffectedObject {
    /** Human-readable name, e.g. "Sketch3 (Frame)". */
    name: string;
    /** Fusion entity token used by Locate; null when the object can't be located. */
    entityToken: string | null;
}

export interface Finding {
    /** Unique within one analysis run. */
    id: string;
    severity: Severity;
    category: FindingCategory;
    title: string;
    description: string;
    affectedObjects: AffectedObject[];
    ruleId: string;
    canAutoFix: boolean;
}

export const SEVERITY_ORDER: readonly Severity[] = ["critical", "warning", "info"];
