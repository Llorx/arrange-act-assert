import { LineRange } from "./Line";
import { CoverageEntry, CoverageLine } from "./processCoverage";

function mergeRanges(rangeA:LineRange[], rangeB:LineRange[]) {
    const result:LineRange[] = [];
    const allRanges = [...rangeA, ...rangeB];
    const boundaries = new Set<number>();
    for (const range of allRanges) {
        boundaries.add(range.start);
        boundaries.add(range.end);
    }
    const sortedPoints = Array.from(boundaries).sort((a, b) => a - b);
    for (let i = 0; i < sortedPoints.length - 1; i++) {
        const segStart = sortedPoints[i]!;
        const segEnd = sortedPoints[i + 1]!;
        let count = 0;
        for (const range of allRanges) {
            if (range.start < segEnd && range.end > segStart) {
                count += range.count;
            }
        }
        if (count > 0) {
            result.push({ start: segStart, end: segEnd, count });
        }
    }
    return result;
}
function mergeLines(linesA:CoverageLine[], linesB:CoverageLine[]) {
    while (linesA.length < linesB.length) {
        linesA.push(linesB[linesA.length]!);
    }
    const maxLines = Math.min(linesA.length, linesB.length);
    for (let i = 0; i < maxLines; i++) {
        const lineA = linesA[i]!;
        const lineB = linesB[i]!;
        if (lineB.length > lineA.length) {
            lineA.length = lineB.length;
        }
        lineA.ranges = mergeRanges(lineA.ranges, lineB.ranges);
    }
    return linesA;
}
export default function merge(coverage:CoverageEntry[][]) {
    const files = new Map<string, CoverageEntry>();
    for (const entries of coverage) {
        for (const entry of entries) {
            const oldEntry = files.get(entry.file);
            if (oldEntry) {
                if (entry.error && !oldEntry.error) {
                    oldEntry.error = entry.error;
                }
                oldEntry.lines = mergeLines(oldEntry.lines, entry.lines);
            } else {
                files.set(entry.file, entry);
            }
        }
    }
    return Array.from(files.values());
}