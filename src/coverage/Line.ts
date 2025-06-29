export type LineRange = {
    start:number;
    end:number;
    count:number;
};
type LineBlock = {
    start:number;
    end:number;
    count:number;
    next:LineBlock|null;
    prev:LineBlock|null;
};
export class Line {
    private _blocks:LineBlock|null = null;
    readonly length;
    constructor(readonly start:number, readonly end:number, readonly ignored:boolean) {
        this.length = end - start;
    }
    private _prepend(block:LineBlock, start:number, end:number, count:number) {
        if (block.start <= end && block.count === count) {
            block.start = start;
        } else {
            if (block.start < end) {
                block.start = end;
                if (block.start === block.end) {
                    if (count > 0) {
                        this._overwrite(block, start, end, count);
                    } else {
                        this._delete(block);
                    }
                    return;
                }
            }
            if (count > 0) {
                block.prev = {
                    start: start,
                    end: end,
                    count: count,
                    prev: block.prev,
                    next: block
                };
                if (block.prev.prev) {
                    block.prev.prev.next = block.prev;
                } else {
                    this._blocks = block.prev;
                }
            }
        }
    }
    private _append(block:LineBlock, start:number, end:number, count:number) {
        if (block.end >= start && block.count === count) {
            block.end = end;
        } else {
            if (block.end > start) {
                block.end = start;
                if (block.start === block.end) {
                    if (count > 0) {
                        this._overwrite(block, start, end, count);
                    } else {
                        this._delete(block);
                    }
                    return block;
                }
            }
            if (count > 0) {
                block.next = {
                    start: start,
                    end: end,
                    count: count,
                    prev: block,
                    next: block.next
                };
                if (block.next.next) {
                    block.next.next.prev = block.next;
                }
                return block.next;
            }
        }
        return block;
    }
    private _overwrite(block:LineBlock, start:number, end:number, count:number) {
        block.start = start;
        block.end = end;
        block.count = count;
    }
    private _split(block:LineBlock, start:number, end:number, count:number) {
        if (block.count !== count) {
            const oldEnd = block.end;
            block.end = start;
            const appendedBlock = this._append(block, start, end, count);
            if (end < oldEnd) {
                this.count(end, oldEnd, block.count, appendedBlock);
            }
        }
    }
    private _delete(block:LineBlock) {
        if (block.prev) {
            block.prev.next = block.next;
        } else {
            this._blocks = block.next;
        }
        if (block.next) {
            block.next.prev = block.prev;
        }
    }
    count(start:number, end:number|null, count:number, nextBlock = this._blocks) {
        // Push a range count and create a linear range without overlaps
        if (end == null || end > this.length) {
            end = this.length;
        }
        if (start === end) {
            return;
        }
        if (!nextBlock) {
            this._blocks = {
                start: start,
                end: end,
                count: count,
                next: null,
                prev: null
            };
            return;
        }
        let lastNextBlock = nextBlock;
        do {
            if (nextBlock.end >= end) {
                if (nextBlock.start < start) {
                    this._split(nextBlock, start, end, count);
                } else {
                    this._prepend(nextBlock, start, end, count);
                }
                return;
            } else if (nextBlock.end >= start) {
                let limitEnd = (nextBlock.next && nextBlock.next.start < end) ? nextBlock.next.start : end;
                if (limitEnd > start) {
                    const appendedBlock = this._append(nextBlock, start, limitEnd, count);
                    if (limitEnd !== end) {
                        this.count(limitEnd, end, count, appendedBlock);
                    }
                    return;
                }
            }
            lastNextBlock = nextBlock;
            nextBlock = nextBlock.next;
        } while (nextBlock);
        this._append(lastNextBlock, start, end, count);
    }
    getRanges(partial:boolean) {
        const ranges:LineRange[] = [];
        let nextOffset = 0;
        if (this.ignored) {
            ranges.push({
                start: 0,
                end: nextOffset = this.length,
                count: 1
            });
        } else {
            let nextBlock = this._blocks;
            let lastRange:LineRange|null = null;
            while (nextBlock) {
                if (lastRange && lastRange.end === nextBlock.start && lastRange.count === nextBlock.count) {
                    lastRange.end = nextBlock.end;
                    if (lastRange.end !== nextOffset) {
                        nextOffset = lastRange.end;
                    }
                } else {
                    if (nextBlock.start !== nextOffset) {
                        nextOffset = nextBlock.end;
                    }
                    ranges.push(lastRange = {
                        start: nextBlock.start,
                        end: nextBlock.end,
                        count: nextBlock.count
                    });
                }
                nextBlock = nextBlock.next;
            }
        }
        if (partial || nextOffset === this.length) {
            return ranges;
        } else {
            return [];
        }
    }
}