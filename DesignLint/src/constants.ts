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

// Short entity type names (Base.objectType without namespace) used by rules.
export const ENTITY_TYPES = {
    sketch: "Sketch",
} as const;

/** Construction geometry types expose their owner as `component` rather than `parentComponent`. */
export const CONSTRUCTION_TYPE_PREFIX = "Construction";

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
    timelineHealth: "timeline-health",
    defaultNames: "default-names",
} as const;

// Default-name detection (rule "default-names").
// A name is "default" when, after normalization (lower case, trailing " (n)" copy suffix removed,
// spaces/hyphens/underscores removed), it is one of these bases followed by digits, e.g. "Sketch12".
// Timeline items also match their own type: ExtrudeFeature -> "extrude" matches "Extrude3".
// Based on Fusion's English UI naming; localized UIs generate other names and are not detected.
export const DEFAULT_NAME_BASES = {
    sketch: ["sketch"],
    body: ["body"],
    component: ["component"],
    /** Extra bases for timeline items whose default name differs from their type. */
    timelineItem: ["plane", "axis", "point"],
} as const;

/** Suffix stripped from a timeline item's type to get its default-name base. */
export const FEATURE_TYPE_SUFFIX = "Feature";
