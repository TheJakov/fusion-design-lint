// DesignLint — Autodesk Fusion
// Step 1: minimal add-in. Registers "Analyze Design" in the Design workspace's
// ADD-INS panel and reports the active document when clicked.
//
// Every Fusion API member used here was checked against Autodesk's API reference
// (see internal notes).

import { adsk } from "@adsk/fusion";
import {
    ADDINS_PANEL_ID,
    ANALYZE_COMMAND_ID,
    ANALYZE_COMMAND_NAME,
    ANALYZE_COMMAND_TOOLTIP,
    DESIGN_WORKSPACE_ID,
    LOG_PREFIX,
    OBJECT_TYPES,
    PRODUCT_NAME,
} from "./src/constants";

// Keep handler objects referenced for the add-in's lifetime.
const handlers: object[] = [];

function log(message: string): void {
    adsk.log(`${LOG_PREFIX}: ${message}`);
}

function reportFailure(context: string, err: unknown): void {
    const message = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    log(`${context} failed: ${message}`);
    try {
        adsk.core.Application.get()?.userInterface?.messageBox(`${context} failed:\n${message}`, PRODUCT_NAME);
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
            ui.messageBox("No active document. Open a Fusion design and try again.", PRODUCT_NAME);
            return;
        }
        // Fusion build 2705.1.25 throws on `instanceof adsk.fusion.Design` ("Right-hand side of
        // 'instanceof' is not callable"), so check Base.objectType instead.
        const product = app.activeProduct;
        if (!product || product.objectType !== OBJECT_TYPES.design) {
            ui.messageBox(`"${doc.name}" is not a Fusion design. Switch to the Design workspace and try again.`, PRODUCT_NAME);
            return;
        }
        const design = product as adsk.fusion.Design;
        const timelineCount = design.timeline ? design.timeline.count : 0;
        const message =
            `Document: ${doc.name}\n` +
            `Root component: ${design.rootComponent.name}\n` +
            `Components: ${design.allComponents.count}\n` +
            `Timeline items: ${timelineCount}`;
        log(message.replace(/\n/g, " | "));
        ui.messageBox(message, PRODUCT_NAME);
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
        log("started");
    } catch (err) {
        reportFailure("DesignLint start", err);
    }
}

export function stop(_context: string): void {
    try {
        const ui = adsk.core.Application.get()!.userInterface!;
        const panel = ui.workspaces.itemById(DESIGN_WORKSPACE_ID)?.toolbarPanels.itemById(ADDINS_PANEL_ID);
        panel?.controls.itemById(ANALYZE_COMMAND_ID)?.deleteMe();
        ui.commandDefinitions.itemById(ANALYZE_COMMAND_ID)?.deleteMe();
        log("stopped");
    } catch (err) {
        reportFailure("DesignLint stop", err);
    }
}
