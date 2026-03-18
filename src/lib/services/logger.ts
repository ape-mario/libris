/**
 * Lightweight error logger.
 * Logs to console in dev, can be extended to send to a remote service.
 *
 * To enable remote logging, set VITE_LOG_ENDPOINT in your env:
 *   VITE_LOG_ENDPOINT=https://your-logging-service.com/api/log
 */

const LOG_ENDPOINT =
	typeof import.meta !== 'undefined'
		? (import.meta as any).env?.VITE_LOG_ENDPOINT
		: undefined;

interface LogEntry {
	level: 'error' | 'warn' | 'info';
	message: string;
	context?: Record<string, unknown>;
	timestamp: string;
	url?: string;
}

const queue: LogEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush() {
	if (!LOG_ENDPOINT || queue.length === 0) return;
	const entries = queue.splice(0);
	// Fire-and-forget — don't block the app
	fetch(LOG_ENDPOINT, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ entries }),
		keepalive: true
	}).catch(() => {
		// Silently ignore — logging should never break the app
	});
}

function enqueue(entry: LogEntry) {
	queue.push(entry);
	if (!flushTimer) {
		flushTimer = setTimeout(() => {
			flushTimer = null;
			flush();
		}, 5000);
	}
}

export function logError(message: string, context?: Record<string, unknown>) {
	console.error(`[Libris] ${message}`, context || '');
	enqueue({
		level: 'error',
		message,
		context,
		timestamp: new Date().toISOString(),
		url: typeof location !== 'undefined' ? location.href : undefined
	});
}

export function logWarn(message: string, context?: Record<string, unknown>) {
	console.warn(`[Libris] ${message}`, context || '');
	enqueue({
		level: 'warn',
		message,
		context,
		timestamp: new Date().toISOString(),
		url: typeof location !== 'undefined' ? location.href : undefined
	});
}

export function logInfo(message: string, context?: Record<string, unknown>) {
	console.log(`[Libris] ${message}`, context || '');
	// Only send info to remote if endpoint is configured
	if (LOG_ENDPOINT) {
		enqueue({
			level: 'info',
			message,
			context,
			timestamp: new Date().toISOString(),
			url: typeof location !== 'undefined' ? location.href : undefined
		});
	}
}

/**
 * Install global error handler to catch uncaught errors.
 * Call once on app startup.
 */
export function installGlobalErrorHandler() {
	if (typeof window === 'undefined') return;

	window.addEventListener('error', (event) => {
		logError('Uncaught error', {
			message: event.message,
			filename: event.filename,
			lineno: event.lineno,
			colno: event.colno
		});
	});

	window.addEventListener('unhandledrejection', (event) => {
		logError('Unhandled promise rejection', {
			reason: String(event.reason)
		});
	});
}
