let history: string[] = [];

export function pushPath(path: string) {
    if (!path) return;
    if (history[history.length - 1] === path) return;
    history.push(path);
    if (history.length > 100) history.shift();
}

/** Returns the previous path (one step back) and pops the current entry. */
export function popPreviousPath(): string | null {
    if (history.length < 2) return null;
    // Remove current
    history.pop();
    // Get previous and remove it so subsequent calls continue moving back
    const prev = history.pop() ?? null;
    if (prev) history.push(prev);
    return prev;
}

export function peekHistory(): string[] {
    return [...history];
}

export default {
    pushPath,
    popPreviousPath,
    peekHistory,
};
