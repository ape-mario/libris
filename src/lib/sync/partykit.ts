import type * as Y from 'yjs';
import type { SyncProvider, SyncStatus } from './provider';

const PARTYKIT_HOST = 'libris-sync.username.partykit.dev'; // TODO: replace with actual PartyKit project URL

export function createPartyKitProvider(): SyncProvider {
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

			import('y-partykit/provider')
				.then(({ WebsocketProvider }) => {
					provider = new WebsocketProvider(PARTYKIT_HOST, roomCode, doc, {
						connect: true
					});

					provider.on('sync', (synced: boolean) => {
						if (synced) setStatus('connected');
					});

					provider.on('connection-close', () => {
						setStatus(navigator.onLine ? 'connecting' : 'offline');
					});

					provider.on('connection-error', () => {
						setStatus('disconnected');
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
