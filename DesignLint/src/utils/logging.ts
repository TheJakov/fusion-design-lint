import { adsk } from "@adsk/fusion";
import { LOG_PREFIX, PRODUCT_NAME } from "../constants";

/** Writes to Fusion's TEXT COMMAND window. */
export function log(message: string): void {
    adsk.log(`${LOG_PREFIX}: ${message}`);
}

export function errorMessage(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
}

/** Logs the failure with stack trace and shows it to the user. */
export function reportFailure(context: string, err: unknown): void {
    const detail = err instanceof Error ? `${err.message}\n${err.stack ?? ""}` : String(err);
    log(`${context} failed: ${detail}`);
    try {
        adsk.core.Application.get()?.userInterface?.messageBox(`${context} failed:\n${detail}`, PRODUCT_NAME);
    } catch {
        // UI may be unavailable (e.g. during shutdown).
    }
}
