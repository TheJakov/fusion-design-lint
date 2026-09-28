import { Rule } from "./Rule";
import { sketchHealthRule, sketchUnderConstrainedRule } from "./sketchRules";

/** All rules, in the order they run. */
export const ALL_RULES: readonly Rule[] = [sketchHealthRule, sketchUnderConstrainedRule];
