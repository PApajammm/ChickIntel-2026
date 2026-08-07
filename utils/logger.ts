import * as FileSystem from "expo-file-system/legacy";

type LogContext = Record<string, unknown> | undefined;

const LOG_DIR = `${FileSystem.documentDirectory}ChickInteLLogs/`;
const LOG_FILE = `${LOG_DIR}chickintel-logs.jsonl`;

async function ensureLogDir() {
    try {
        const info = await FileSystem.getInfoAsync(LOG_DIR);
        if (!info.exists) {
            await FileSystem.makeDirectoryAsync(LOG_DIR, {
                intermediates: true,
            });
        }
    } catch {
        // ignore
    }
}

function safeStringify(context?: LogContext) {
    try {
        return context ? JSON.stringify(context) : undefined;
    } catch {
        return undefined;
    }
}

async function appendLogToFile(entry: unknown) {
    try {
        await ensureLogDir();
        const line = `${JSON.stringify(entry)}\n`;
        const info = await FileSystem.getInfoAsync(LOG_FILE);
        const existing = info.exists
            ? await FileSystem.readAsStringAsync(LOG_FILE)
            : "";
        await FileSystem.writeAsStringAsync(LOG_FILE, `${existing}${line}`, {
            encoding: FileSystem.EncodingType.UTF8,
        });
    } catch {
        // best-effort only
    }
}

function emitConsole(
    level: "info" | "warn" | "error" | "debug",
    timestamp: string,
    message: string,
    context?: LogContext,
) {
    const ctx = safeStringify(context);
    const formatted = `[ChickInteL][${timestamp}][${level}] ${message}${ctx ? ` ${ctx}` : ""}`;
    if (level === "error") console.error(formatted);
    else console.log(formatted);
}

function log(
    level: "info" | "warn" | "error" | "debug",
    message: string,
    context?: LogContext,
) {
    const timestamp = new Date().toISOString();
    emitConsole(level, timestamp, message, context);
    // fire-and-forget append to disk
    appendLogToFile({ ts: timestamp, level, message, context }).catch(
        () => null,
    );
}

export function logStep(step: string, context?: LogContext) {
    log("info", step, context);
}

export function logError(step: string, error: unknown, context?: LogContext) {
    const err =
        typeof error === "string"
            ? error
            : error instanceof Error
              ? error.message
              : String(error);
    log("error", step, {
        error: err,
        ...(error instanceof Error && error.stack ? { stack: error.stack } : {}),
        ...(context || {}),
    });
}

export function logDebug(step: string, context?: LogContext) {
    log("debug", step, context);
}

export async function initLogger() {
    await ensureLogDir();
}
