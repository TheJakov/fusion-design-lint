// String helpers that avoid Intl/ICU: Fusion's TypeScript runtime throws "Internal error. Icu error"
// from String.localeCompare with options (see internal notes).

const CHUNK_PATTERN = /(\d+)|(\D+)/g;

/** Natural order: "Sketch2" < "Sketch10". Digit runs compare numerically, other text by code unit. */
export function naturalCompare(a: string, b: string): number {
    const chunksA = a.match(CHUNK_PATTERN) ?? [];
    const chunksB = b.match(CHUNK_PATTERN) ?? [];
    const length = Math.min(chunksA.length, chunksB.length);
    for (let i = 0; i < length; i++) {
        const x = chunksA[i];
        const y = chunksB[i];
        if (x === y) {
            continue;
        }
        const isNumberX = x.charCodeAt(0) >= 48 && x.charCodeAt(0) <= 57;
        const isNumberY = y.charCodeAt(0) >= 48 && y.charCodeAt(0) <= 57;
        if (isNumberX && isNumberY) {
            const diff = Number(x) - Number(y);
            if (diff !== 0) {
                return diff;
            }
            // Same value, different zero padding: shorter first.
            return x.length - y.length;
        }
        return x < y ? -1 : 1;
    }
    return chunksA.length - chunksB.length;
}
