// Shows analysis results in a Fusion HTML palette (resources/findings.html).
//
// Handshake: the page sends "ready" (adsk.fusionSendData) once loaded; the add-in answers with
// sendInfoToHTML("results", json). When the palette is already open, new results are sent directly.
// The page sends "locate" with entity tokens; the add-in selects them and answers with "locateResult".
// The page sends "reanalyze"; the add-in re-runs the analysis (new "results"), or answers "reanalyzeFailed".
// Palettes.add with an HTML string fails in the TypeScript runtime ("colon (:) not allowed in the
// path"), so the page is a file referenced by a path relative to the add-in folder.

import { adsk } from "@adsk/fusion";
import { FINDINGS_PALETTE_HTML, FINDINGS_PALETTE_ID, FINDINGS_PALETTE_NAME, FINDINGS_PALETTE_SIZE } from "../constants";
import { AnalysisResult } from "../models/AnalysisResult";
import { errorMessage, log, reportFailure } from "../utils/logging";
import { LocateTarget, locateEntities } from "./locate";

/** What the page receives as the "results" message. */
export interface FindingsPageData {
    result: AnalysisResult;
    elapsedMs: number;
}

/** The document the results belong to; Locate only works while it is the active document. */
export interface AnalysisContext {
    document: adsk.core.Document;
    design: adsk.fusion.Design;
}

const PAGE_ACTIONS = {
    ready: "ready",
    results: "results",
    locate: "locate",
    locateResult: "locateResult",
    reanalyze: "reanalyze",
    reanalyzeFailed: "reanalyzeFailed",
} as const;

/** Runs the analysis; returns why it could not run, or null. Set by the command module. */
let reanalyze: (() => string | null) | null = null;

export function setReanalyzeHandler(handler: () => string | null): void {
    reanalyze = handler;
}

let latestResultsJson: string | null = null;
let latestContext: AnalysisContext | null = null;
// Keep handler objects referenced for the add-in's lifetime.
const handlers: object[] = [];

/** Creates the palette or sends new results to the open one. Throws if Fusion cannot create it. */
export function showFindingsPalette(
    ui: adsk.core.UserInterface,
    data: FindingsPageData,
    context: AnalysisContext,
): void {
    latestResultsJson = JSON.stringify(data);
    latestContext = context;

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
    const incomingHandler = { notify: (args: adsk.core.HTMLEventArgs) => onIncomingFromHtml(ui, palette, args) };
    palette.incomingFromHTML.add(incomingHandler);
    handlers.push(incomingHandler);
}

export function deleteFindingsPalette(ui: adsk.core.UserInterface): void {
    ui.palettes.itemById(FINDINGS_PALETTE_ID)?.deleteMe();
    latestResultsJson = null;
    latestContext = null;
}

function onIncomingFromHtml(ui: adsk.core.UserInterface, palette: adsk.core.Palette, args: adsk.core.HTMLEventArgs): void {
    try {
        if (args.action === PAGE_ACTIONS.ready && latestResultsJson) {
            palette.sendInfoToHTML(PAGE_ACTIONS.results, latestResultsJson);
        } else if (args.action === PAGE_ACTIONS.locate) {
            let reply: LocateReply;
            try {
                reply = handleLocate(ui, args.data);
            } catch (err) {
                // Report Locate problems in the palette, not as a modal dialog.
                log(`Locate failed: ${errorMessage(err)}`);
                reply = { ok: false, message: `Locate failed: ${errorMessage(err)}` };
            }
            palette.sendInfoToHTML(PAGE_ACTIONS.locateResult, JSON.stringify(reply));
        } else if (args.action === PAGE_ACTIONS.reanalyze) {
            handleReanalyze(palette);
        } else if (args.action !== "response") {
            // "response" carries the page's reply to sendInfoToHTML (asynchronous with the new browser).
            log(`Findings palette: unhandled message "${args.action}".`);
        }
        args.returnData = "OK";
    } catch (err) {
        reportFailure("Findings palette message", err);
    }
}

interface LocateReply {
    ok: boolean;
    message: string;
}

function handleLocate(ui: adsk.core.UserInterface, data: string): LocateReply {
    const context = latestContext;
    const app = adsk.core.Application.get();
    if (!context || !app || app.activeDocument !== context.document || !context.design.isValid) {
        return { ok: false, message: "These results belong to another document. Run Analyze Design again." };
    }
    let targets: LocateTarget[];
    try {
        const parsed = JSON.parse(data) as { targets?: unknown };
        targets = Array.isArray(parsed.targets) ? parsed.targets.filter(isLocateTarget) : [];
    } catch (err) {
        return { ok: false, message: `Invalid locate request: ${errorMessage(err)}` };
    }
    if (targets.length === 0) {
        return { ok: false, message: "Nothing to locate for this finding." };
    }

    const result = locateEntities(context.design, ui.activeSelections, targets);
    for (const failure of result.failed) {
        log(`Locate: could not select ${failure}`);
    }
    if (result.selected === 0) {
        const reason =
            result.failed.length > 0
                ? `Fusion could not select ${result.failed[0]}`
                : `${result.notFound.join(", ")} no longer exist(s); run Analyze Design again`;
        return { ok: false, message: `Could not locate: ${reason}.` };
    }
    const parts = [`Selected ${result.selected} object(s).`];
    if (result.notFound.length > 0) {
        parts.push(`${result.notFound.join(", ")} no longer exist(s); run Analyze Design again.`);
    }
    if (result.failed.length > 0) {
        const more = result.failed.length > 1 ? ` (+${result.failed.length - 1} more)` : "";
        parts.push(`Fusion could not select ${result.failed[0]}${more}.`);
    }
    return { ok: true, message: parts.join(" ") };
}

function isLocateTarget(value: unknown): value is LocateTarget {
    const t = value as Partial<LocateTarget> | null;
    return typeof t?.name === "string" && typeof t.entityToken === "string";
}

/** On success runAnalysis sends new results to this palette itself; only failures need a reply. */
function handleReanalyze(palette: adsk.core.Palette): void {
    let problem: string | null;
    try {
        problem = reanalyze ? reanalyze() : "Re-analyze is not available.";
    } catch (err) {
        log(`Re-analyze failed: ${errorMessage(err)}`);
        problem = `Analysis failed: ${errorMessage(err)}`;
    }
    if (problem) {
        palette.sendInfoToHTML(PAGE_ACTIONS.reanalyzeFailed, JSON.stringify({ message: problem }));
    }
}
