import { DesignModel } from "../models/DesignModel";
import { Finding, FindingCategory } from "../models/Finding";

/** A deterministic check over the normalized model. Rules never touch the Fusion API. */
export interface Rule {
    id: string;
    category: FindingCategory;
    /** One line describing what the rule checks. */
    description: string;
    evaluate(model: DesignModel): Finding[];
}
