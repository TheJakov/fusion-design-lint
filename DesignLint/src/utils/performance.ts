export interface Timing {
    label: string;
    ms: number;
}

/** Runs fn, records how long it took, and returns its result. */
export function timed<T>(label: string, timings: Timing[], fn: () => T): T {
    const start = Date.now();
    try {
        return fn();
    } finally {
        timings.push({ label, ms: Date.now() - start });
    }
}

export function formatTimings(timings: Timing[]): string {
    return timings.map((t) => `${t.label} ${t.ms} ms`).join(", ");
}
