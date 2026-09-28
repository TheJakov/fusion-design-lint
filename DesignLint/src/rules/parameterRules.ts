// Parameter rules: parameterization suggestions, never engineering errors.

import { REPEATED_VALUES, RULE_IDS, UNIT_KINDS } from "../constants";
import { ModelParameterInfo, UserParameterInfo } from "../models/DesignModel";
import { AffectedObject, Finding } from "../models/Finding";
import { naturalCompare } from "../utils/text";
import { Rule } from "./Rule";

/** "length|0.25" — same physical kind and value, regardless of the unit it was entered in. */
function valueKey(unit: string, value: number): string {
    const kind = UNIT_KINDS[unit] ?? unit;
    return `${kind}|${Number(value.toPrecision(REPEATED_VALUES.significantDigits))}`;
}

function isCandidate(param: ModelParameterInfo): boolean {
    // Unitless values (counts, ratios) and zero (e.g. default joint offsets) carry no design intent.
    return param.isHardCoded && param.unit !== "" && param.value !== 0;
}

function ownerLabel(param: ModelParameterInfo): string {
    return `${param.ownerName} (${param.componentName})`;
}

export const repeatedValuesRule: Rule = {
    id: RULE_IDS.repeatedValues,
    category: "parameter",
    description: "The same hard-coded value entered in several model elements.",
    evaluate(model) {
        const groups = new Map<string, ModelParameterInfo[]>();
        for (const param of model.modelParameters) {
            if (!isCandidate(param)) {
                continue;
            }
            const key = valueKey(param.unit, param.value);
            const group = groups.get(key);
            if (group) {
                group.push(param);
            } else {
                groups.set(key, [param]);
            }
        }

        const userParamsByKey = new Map<string, UserParameterInfo[]>();
        for (const userParam of model.userParameters) {
            if (userParam.value === null || userParam.unit === "") {
                continue;
            }
            const key = valueKey(userParam.unit, userParam.value);
            userParamsByKey.set(key, [...(userParamsByKey.get(key) ?? []), userParam]);
        }

        const findings: Finding[] = [];
        for (const [key, params] of groups) {
            // One entry per distinct owner (a feature or sketch can hold the value several times).
            const byOwner = new Map<string, AffectedObject>();
            for (const param of params) {
                const label = ownerLabel(param);
                if (!byOwner.has(label)) {
                    byOwner.set(label, { name: label, entityToken: param.ownerEntityToken });
                }
            }
            const owners = [...byOwner.values()].sort((a, b) => naturalCompare(a.name, b.name));
            if (owners.length < REPEATED_VALUES.minOwners) {
                continue;
            }
            const display = params[0].displayValue;
            const matching = (userParamsByKey.get(key) ?? []).map((p) => p.name).sort(naturalCompare);
            const userParamHint =
                matching.length > 0
                    ? ` User parameter ${matching.join(", ")} has the same value; referencing it could keep these values in sync.`
                    : "";
            findings.push({
                id: `${RULE_IDS.repeatedValues}:${findings.length}`,
                severity: "info",
                category: "parameter",
                title: `Repeated hard-coded value: ${display}`,
                description:
                    `${display} is entered directly ${params.length} time(s) across ${owners.length} model elements. ` +
                    "This may represent design intent that could be expressed through a user parameter." +
                    userParamHint,
                affectedObjects: owners,
                ruleId: RULE_IDS.repeatedValues,
                canAutoFix: false,
            });
        }
        return findings;
    },
};
