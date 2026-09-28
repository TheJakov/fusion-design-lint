// Shows analysis results in a Fusion HTML palette (resources/findings.html).
//
// Handshake: the page sends "ready" (adsk.fusionSendData) once loaded; the add-in answers with
// sendInfoToHTML("results", json). When the palette is already open, new results are sent directly.
// Palettes.add with an HTML string fails in the TypeScript runtime ("colon (:) not allowed in the
// path"), so the page is a file referenced by a path relative to the add-in folder.

import { adsk } from "@adsk/fusion";
import { FINDINGS_PALETTE_HTML, FINDINGS_PALETTE_ID, FINDINGS_PALETTE_NAME, FINDINGS_PALETTE_SIZE } from "../constants";
import { AnalysisResult } from "../models/AnalysisResult";
import { log, reportFailure } from "../utils/logging";

/** What the page receives as the "results" message. */
export interface FindingsPageData {
    result: AnalysisResult;
    elapsedMs: number;
}

const PAGE_ACTIONS = {
    ready: "ready",
    results: "results",
} as const;

let latestResultsJson: string | null = null;
// Keep handler objects referenced for the add-in's lifetime.
const handlers: object[] = [];

/** Creates the palette or sends new results to the open one. Throws if Fusion cannot create it. */
export function showFindingsPalette(ui: adsk.core.UserInterface, data: FindingsPageData): void {
    latestResultsJson = JSON.stringify(data);

    const existing = ui.palettes.itemById(FINDINGS_PALETTE_ID);
    if (existing) {
        existing.isVisible = true;
        // The page is already loaded; if it isn't yet, its "ready" message will fetch these results.
        existing.sendInfoToHTML(PAGE_ACTIONS.results, latestResultsJson);
        return;
    }

    const palette = ui.palettes.add(
        FINDINGS_PALETTE_ID,
        FINDINGS_PALETTE_NAME,
        FINDINGS_PALETTE_HTML,
        true, // isVisible
        true, // showCloseButton
        true, // isResizable
        FINDINGS_PALETTE_SIZE.width,
        FINDINGS_PALETTE_SIZE.height,
    );
    if (!palette) {
        throw new Error(`Could not create palette ${FINDINGS_PALETTE_ID}.`);
    }
    const incomingHandler = { notify: (args: adsk.core.HTMLEventArgs) => onIncomingFromHtml(palette, args) };
    palette.incomingFromHTML.add(incomingHandler);
    handlers.push(incomingHandler);
}

export function deleteFindingsPalette(ui: adsk.core.UserInterface): void {
    ui.palettes.itemById(FINDINGS_PALETTE_ID)?.deleteMe();
    latestResultsJson = null;
}

function onIncomingFromHtml(palette: adsk.core.Palette, args: adsk.core.HTMLEventArgs): void {
    try {
        if (args.action === PAGE_ACTIONS.ready && latestResultsJson) {
            palette.sendInfoToHTML(PAGE_ACTIONS.results, latestResultsJson);
        } else if (args.action !== "response") {
            // "response" carries the page's reply to sendInfoToHTML (asynchronous with the new browser).
            log(`Findings palette: unhandled message "${args.action}".`);
        }
        args.returnData = "OK";
    } catch (err) {
        reportFailure("Findings palette message", err);
    }
}
