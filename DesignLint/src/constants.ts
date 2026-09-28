// Shared constants for the DesignLint add-in.

export const PRODUCT_NAME = "DesignLint";
export const LOG_PREFIX = PRODUCT_NAME;

// Analyze Design command.
export const ANALYZE_COMMAND_ID = "designLintAnalyzeDesign";
export const ANALYZE_COMMAND_NAME = "Analyze Design";
export const ANALYZE_COMMAND_TOOLTIP =
    "Analyze the active design for CAD quality and parametric robustness issues.";

// Fusion UI locations (IDs from the Fusion API User Interface manual).
export const DESIGN_WORKSPACE_ID = "FusionSolidEnvironment";
export const ADDINS_PANEL_ID = "SolidScriptsAddinsPanel";

// Fusion Base.objectType values. Used instead of `instanceof`, which throws in
// Fusion's TypeScript runtime (see internal notes).
export const OBJECT_TYPES = {
    design: "adsk::fusion::Design",
} as const;

// Numeric values of Fusion `const enum`s, taken from the bundled typings (fusion.d.ts).
// Fusion's transpiler may not inline const enums, so we don't reference them at runtime.
export const DESIGN_TYPES = {
    direct: 0,
    parametric: 1,
} as const;

export const DESIGN_INTENT_TYPES = {
    part: 0,
    assembly: 1,
    hybrid: 2,
} as const;

export const FEATURE_HEALTH_STATES = {
    healthy: 0,
    warning: 1,
    error: 2,
    suppressed: 3,
    rolledBack: 4,
    unknown: 5,
} as const;

// Rule IDs. Stable: used in findings, logs and (later) user configuration.
export const RULE_IDS = {
    sketchUnderConstrained: "sketch-under-constrained",
    sketchHealth: "sketch-health",
} as const;
