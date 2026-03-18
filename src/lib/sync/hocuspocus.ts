import type * as Y from 'yjs';
import type { SyncProvider, SyncStatus } from './provider';

export function createHocuspocusProvider(serverUrl: string): SyncProvider {
	let provider: any = null;
	let currentStatus: SyncStatus = 'disconnected';
	const listeners = new Set<(status: SyncStatus) => void>();

	function setStatus(status: SyncStatus) {
		currentStatus = status;
		listeners.forEach((cb) => cb(status));
	}

	return {
		connect(doc: Y.Doc, roomCode: string) {
			if (!navigator.onLine) {
				setStatus('offline');
				window.addEventListener('online', () => this.connect(doc, roomCode), { once: true });
				return;
			}

			setStatus('connecting');

			import('@hocuspocus/provider')
				.then(({ HocuspocusProvider }) => {
					provider = new HocuspocusProvider({
						url: serverUrl,
						name: roomCode,
						document: doc,
						onSynced() {
							setStatus('connected');
						},
						onClose() {
							setStatus(navigator.onLine ? 'connecting' : 'offline');
						},
						onDisconnect() {
							setStatus(navigator.onLine ? 'connecting' : 'offline');
						}
					});
				})
				.catch(() => {
					setStatus('disconnected');
				});
		},

		disconnect() {
			provider?.destroy();
			provider = null;
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
}
