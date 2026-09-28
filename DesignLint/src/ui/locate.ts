// Locate: select the objects behind a finding in Fusion.
//
// Tokens come from the analysis (entityToken) and are resolved with Design.findEntityByToken.
// Objects in a sub-component must be selected in assembly context, so they are selected through
// every occurrence of their component (createForAssemblyContext). Components are located by
// selecting their occurrences.

import { adsk } from "@adsk/fusion";
import { CONSTRUCTION_TYPE_PREFIX, OBJECT_TYPES } from "../constants";
import { errorMessage } from "../utils/logging";

/** An object to locate, as sent by the findings page. */
export interface LocateTarget {
    name: string;
    entityToken: string;
}

export interface LocateResult {
    /** Number of objects (or object instances) selected. */
    selected: number;
    /** Names of objects whose token no longer resolves (e.g. the object was deleted). */
    notFound: string[];
    /** "name: reason" for objects Fusion could not select. */
    failed: string[];
}

type Proxyable = adsk.core.Base & {
    createForAssemblyContext?: (occurrence: adsk.fusion.Occurrence) => adsk.core.Base | null;
    parentComponent?: adsk.fusion.Component | null;
    component?: adsk.fusion.Component | null;
};

export function locateEntities(
    design: adsk.fusion.Design,
    selections: adsk.core.Selections,
    targets: LocateTarget[],
): LocateResult {
    const result: LocateResult = { selected: 0, notFound: [], failed: [] };
    const root = design.rootComponent;
    selections.clear();

    for (const target of targets) {
        let entities: adsk.core.Base[];
        try {
            entities = design.findEntityByToken(target.entityToken);
        } catch (err) {
            result.failed.push(`${target.name}: ${errorMessage(err)}`);
            continue;
        }
        if (entities.length === 0) {
            result.notFound.push(target.name);
            continue;
        }
        for (const entity of entities) {
            // Some tokens (e.g. from a joint parameter's createdBy) resolve to an object that is not
            // valid: even reading objectType throws "invalid argument entity".
            if (!isValidEntity(entity)) {
                result.failed.push(`${target.name}: Fusion returned an invalid object for it`);
                continue;
            }
            try {
                result.selected += selectInRootContext(entity as Proxyable, root, selections);
            } catch (err) {
                result.failed.push(`${target.name}: ${errorMessage(err)}`);
            }
        }
    }
    return result;
}

function isValidEntity(entity: adsk.core.Base): boolean {
    try {
        return entity.isValid;
    } catch {
        return false;
    }
}

/** Returns how many selections were added. */
function selectInRootContext(entity: Proxyable, root: adsk.fusion.Component, selections: adsk.core.Selections): number {
    if (entity.objectType === OBJECT_TYPES.component) {
        return selectAll(occurrencesOf(entity as unknown as adsk.fusion.Component, root), selections);
    }

    const owner = owningComponent(entity);
    if (!owner || owner === root || typeof entity.createForAssemblyContext !== "function") {
        return selections.add(entity) ? 1 : 0;
    }

    const proxies: adsk.core.Base[] = [];
    for (const occurrence of occurrencesOf(owner, root)) {
        const proxy = entity.createForAssemblyContext(occurrence);
        if (proxy) {
            proxies.push(proxy);
        }
    }
    return selectAll(proxies, selections);
}

function selectAll(entities: adsk.core.Base[], selections: adsk.core.Selections): number {
    let count = 0;
    for (const entity of entities) {
        if (selections.add(entity)) {
            count++;
        }
    }
    return count;
}

function occurrencesOf(component: adsk.fusion.Component, root: adsk.fusion.Component): adsk.fusion.Occurrence[] {
    const list = root.allOccurrencesByComponent(component);
    const result: adsk.fusion.Occurrence[] = [];
    for (let i = 0; i < list.count; i++) {
        const occurrence = list.item(i);
        if (occurrence) {
            result.push(occurrence);
        }
    }
    return result;
}

/** Sketches, bodies, features, joints: parentComponent. Construction geometry: component. */
function owningComponent(entity: Proxyable): adsk.fusion.Component | null {
    const type = entity.objectType;
    const isConstruction = type.slice(type.lastIndexOf("::") + 2).startsWith(CONSTRUCTION_TYPE_PREFIX);
    return (isConstruction ? entity.component : entity.parentComponent) ?? null;
}
