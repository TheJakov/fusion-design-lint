// DesignLint — Autodesk Fusion
// Add-in entry point. Fusion calls run() when the add-in starts and stop() when it stops.
//
// Fusion API usage is verified against the bundled typings and Autodesk's reference
// (see internal notes).

import { adsk } from "@adsk/fusion";
import { registerCommands, unregisterCommands } from "./src/ui/command";
import { log, reportFailure } from "./src/utils/logging";

export function run(_context: string): void {
    try {
        registerCommands(adsk.core.Application.get()!.userInterface!);
        log("started");
    } catch (err) {
        reportFailure("DesignLint start", err);
    }
}

export function stop(_context: string): void {
    try {
        unregisterCommands(adsk.core.Application.get()!.userInterface!);
        log("stopped");
    } catch (err) {
        reportFailure("DesignLint stop", err);
    }
}
