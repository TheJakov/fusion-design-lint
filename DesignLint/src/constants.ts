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
