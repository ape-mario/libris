import type * as Y from 'yjs';
import type { SyncProvider, SyncStatus } from './provider';

type SetupFn = (
	doc: Y.Doc,
	roomCode: string,
	setStatus: (status: SyncStatus) => void
) => Promise<{ destroy: () => void }>;

/**
 * Creates a sync provider with shared boilerplate:
 * offline detection, status listeners, connect/disconnect lifecycle.
 *
 * Each provider only supplies a `setup` function that receives
 * (doc, roomCode, setStatus) and returns { destroy }.
 */
export function createProvider(setup: SetupFn): SyncProvider {
	let instance: { destroy: () => void } | null = null;
	let currentStatus: SyncStatus = 'disconnected';
	let pendingOnlineHandler: (() => void) | null = null;
	const listeners = new Set<(status: SyncStatus) => void>();

	function setStatus(status: SyncStatus) {
		currentStatus = status;
		listeners.forEach((cb) => cb(status));
	}

	function cleanupOnlineListener() {
		if (pendingOnlineHandler) {
			window.removeEventListener('online', pendingOnlineHandler);
			pendingOnlineHandler = null;
		}
	}

	const provider: SyncProvider = {
		connect(doc: Y.Doc, roomCode: string) {
			cleanupOnlineListener();

			if (typeof navigator !== 'undefined' && !navigator.onLine) {
				setStatus('offline');
				pendingOnlineHandler = () => provider.connect(doc, roomCode);
				window.addEventListener('online', pendingOnlineHandler, { once: true });
				return;
			}

			setStatus('connecting');

			setup(doc, roomCode, setStatus)
				.then((p) => {
					instance = p;
				})
				.catch(() => {
					setStatus('disconnected');
				});
		},

		disconnect() {
			cleanupOnlineListener();
			instance?.destroy();
			instance = null;
			setStatus('disconnected');
		},

		get status() {
			return currentStatus;
		},

		onStatusChange(cb) {
			listeners.add(cb);
			return () => listeners.delete(cb);
		}
	};

	return provider;
}
