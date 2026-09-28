// "Analyze Design" command: toolbar registration and execution.

import { adsk } from "@adsk/fusion";
import { extractDesignModel } from "../analyzer/modelExtractor";
import { analyzeModel } from "../analyzer/analysisEngine";
import {
    ADDINS_PANEL_ID,
    ANALYZE_COMMAND_ID,
    ANALYZE_COMMAND_NAME,
    ANALYZE_COMMAND_TOOLTIP,
    DESIGN_WORKSPACE_ID,
    OBJECT_TYPES,
    PRODUCT_NAME,
} from "../constants";
import { log, reportFailure } from "../utils/logging";
import { formatTimings, timed, Timing } from "../utils/performance";
import { ALL_RULES } from "../rules/ruleRegistry";
import { formatAnalysisReport, formatFindingForLog } from "./analysisReport";

// Keep handler objects referenced for the add-in's lifetime.
const handlers: object[] = [];

export function registerCommands(ui: adsk.core.UserInterface): void {
    const cmdDef =
        ui.commandDefinitions.itemById(ANALYZE_COMMAND_ID) ??
        ui.commandDefinitions.addButtonDefinition(ANALYZE_COMMAND_ID, ANALYZE_COMMAND_NAME, ANALYZE_COMMAND_TOOLTIP);
    if (!cmdDef) {
        throw new Error(`Could not create command definition ${ANALYZE_COMMAND_ID}.`);
    }
    const createdHandler = { notify: onCommandCreated };
    cmdDef.commandCreated.add(createdHandler);
    handlers.push(createdHandler);

    const panel = ui.workspaces.itemById(DESIGN_WORKSPACE_ID)?.toolbarPanels.itemById(ADDINS_PANEL_ID);
    if (!panel) {
        log(`Toolbar panel ${DESIGN_WORKSPACE_ID}/${ADDINS_PANEL_ID} not found; command is registered but has no button.`);
    } else if (!panel.controls.itemById(ANALYZE_COMMAND_ID)) {
        const control = panel.controls.addCommand(cmdDef);
        if (control) {
            control.isPromoted = true;
        }
    }
}

export function unregisterCommands(ui: adsk.core.UserInterface): void {
    const panel = ui.workspaces.itemById(DESIGN_WORKSPACE_ID)?.toolbarPanels.itemById(ADDINS_PANEL_ID);
    panel?.controls.itemById(ANALYZE_COMMAND_ID)?.deleteMe();
    ui.commandDefinitions.itemById(ANALYZE_COMMAND_ID)?.deleteMe();
}

function onCommandCreated(args: adsk.core.CommandCreatedEventArgs): void {
    try {
        const executeHandler = { notify: onExecute };
        args.command.execute.add(executeHandler);
        handlers.push(executeHandler);
    } catch (err) {
        reportFailure("Command creation", err);
    }
}

function onExecute(_args: adsk.core.CommandEventArgs): void {
    try {
        const app = adsk.core.Application.get()!;
        const ui = app.userInterface!;
        const doc = app.activeDocument;
        if (!doc) {
            ui.messageBox("No active document. Open a Fusion design and try again.", PRODUCT_NAME);
            return;
        }
        const product = app.activeProduct;
        if (!product || product.objectType !== OBJECT_TYPES.design) {
            ui.messageBox(`"${doc.name}" is not a Fusion design. Switch to the Design workspace and try again.`, PRODUCT_NAME);
            return;
        }
        const design = product as adsk.fusion.Design;

        const timings: Timing[] = [];
        const start = Date.now();
        const model = timed("extraction", timings, () => extractDesignModel(design, doc.name));
        const result = timed("rules", timings, () => analyzeModel(model, ALL_RULES));
        const elapsedMs = Date.now() - start;

        log(`Analysis of "${doc.name}" complete in ${elapsedMs} ms (${formatTimings(timings)}).`);
        log(`Summary: ${JSON.stringify(result.summary)}`);
        if (model.timelineItemCount !== null) {
            const byHealth = new Map<string, number>();
            for (const item of model.timelineItems) {
                byHealth.set(item.healthState, (byHealth.get(item.healthState) ?? 0) + 1);
            }
            const health = [...byHealth].map(([state, count]) => `${state} ${count}`).join(", ");
            log(
                `Timeline: ${model.timelineItemCount} top-level row(s), ${model.timelineItems.length} item(s) ` +
                    `inspected including group contents (${health || "none"}).`,
            );
        }
        for (const finding of result.findings) {
            log(formatFindingForLog(finding));
        }
        for (const failure of result.ruleFailures) {
            log(`Rule ${failure.ruleId} failed: ${failure.message}`);
        }
        ui.messageBox(formatAnalysisReport(result, elapsedMs), PRODUCT_NAME);
    } catch (err) {
        reportFailure("Analyze Design", err);
    }
}
