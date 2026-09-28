import { defaultNamesRule } from "./organizationRules";
import { Rule } from "./Rule";
import { sketchHealthRule, sketchUnderConstrainedRule } from "./sketchRules";
import { timelineHealthRule } from "./timelineRules";

/** All rules, in the order they run. */
export const ALL_RULES: readonly Rule[] = [timelineHealthRule, sketchHealthRule, sketchUnderConstrainedRule, defaultNamesRule];
