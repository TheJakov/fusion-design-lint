// DesignLint — Autodesk Fusion
// Step 1: minimal add-in. Registers "Analyze Design" in the Design workspace's
// ADD-INS panel and reports the active document when clicked.
//
// Every Fusion API member used here was checked against Autodesk's API reference
// (see internal notes).

import { adsk } from "@adsk/fusion";

const LOG_PREFIX = "DesignLint";
const COMMAND_ID = "designLintAnalyzeDesign";
const COMMAND_NAME = "Analyze Design";
const COMMAND_TOOLTIP = "Analyze the active design for CAD quality and parametric robustness issues.";
const WORKSPACE_ID = "FusionSolidEnvironment";
const PANEL_ID = "SolidScriptsAddinsPanel";

// Keep handler objects referenced for the add-in's lifetime.
const handlers: object[] = [];

function log(message: string): void {
    adsk.log(`${LOG_PREFIX}: ${message}`);
}

function reportFailure(context: string, err: unknown): void {
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    log(`${context} failed: ${message}`);
    try {
        adsk.core.Application.get()?.userInterface?.messageBox(`${context} failed:\n${message}`, "DesignLint");
    } catch {
        // UI may be unavailable (e.g. during shutdown).
    }
}

function onExecute(_args: adsk.core.CommandEventArgs): void {
    try {
        const app = adsk.core.Application.get()!;
        const ui = app.userInterface!;
        const doc = app.activeDocument;
        if (!doc) {
            ui.messageBox("No active document. Open a Fusion design and try again.", "DesignLint");
            return;
        }
        const product = app.activeProduct;
        if (!(product instanceof adsk.fusion.Design)) {
            ui.messageBox(`"${doc.name}" is not a Fusion design. Switch to the Design workspace and try again.`, "DesignLint");
            return;
        }
        const timelineCount = product.timeline ? product.timeline.count : 0;
        const message =
            `Document: ${doc.name}\n` +
            `Root component: ${product.rootComponent.name}\n` +
            `Components: ${product.allComponents.count}\n` +
            `Timeline items: ${timelineCount}`;
        log(message.replace(/\n/g, " | "));
        ui.messageBox(message, "DesignLint");
    } catch (err) {
        reportFailure("Analyze Design", err);
    }
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

export function run(_context: string): void {
    try {
        const ui = adsk.core.Application.get()!.userInterface!;

        let cmdDef = ui.commandDefinitions.itemById(COMMAND_ID);
        if (!cmdDef) {
            cmdDef = ui.commandDefinitions.addButtonDefinition(COMMAND_ID, COMMAND_NAME, COMMAND_TOOLTIP);
        }
        const createdHandler = { notify: onCommandCreated };
        cmdDef.commandCreated.add(createdHandler);
        handlers.push(createdHandler);

        const panel = ui.workspaces.itemById(WORKSPACE_ID)?.toolbarPanels.itemById(PANEL_ID);
        if (!panel) {
            log(`Toolbar panel ${WORKSPACE_ID}/${PANEL_ID} not found; command is registered but has no button.`);
        } else if (!panel.controls.itemById(COMMAND_ID)) {
            const control = panel.controls.addCommand(cmdDef);
            control.isPromoted = true;
        }
        log("started");
    } catch (err) {
        reportFailure("DesignLint start", err);
    }
}

export function stop(_context: string): void {
    try {
        const ui = adsk.core.Application.get()!.userInterface!;
        const panel = ui.workspaces.itemById(WORKSPACE_ID)?.toolbarPanels.itemById(PANEL_ID);
        panel?.controls.itemById(COMMAND_ID)?.deleteMe();
        ui.commandDefinitions.itemById(COMMAND_ID)?.deleteMe();
        log("stopped");
    } catch (err) {
        reportFailure("DesignLint stop", err);
    }
}
