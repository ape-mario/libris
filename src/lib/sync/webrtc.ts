import type * as Y from 'yjs';
import type { SyncProvider, SyncStatus } from './provider';

export function createWebRTCProvider(): SyncProvider {
	let provider: any = null;
	let currentStatus: SyncStatus = 'disconnected';
	const listeners = new Set<(status: SyncStatus) => void>();

	function setStatus(status: SyncStatus) {
		currentStatus = status;
		listeners.forEach((cb) => cb(status));
	}

	return {
		connect(doc: Y.Doc, roomCode: string) {
			setStatus('connecting');

			import('y-webrtc')
				.then(({ WebrtcProvider }) => {
					provider = new WebrtcProvider(`libris-${roomCode}`, doc, {
						signaling: [
							'wss://signaling.yjs.dev',
							'wss://y-webrtc-signaling-eu.herokuapp.com',
							'wss://y-webrtc-signaling-us.herokuapp.com'
						]
					});

					provider.on('synced', ({ synced }: { synced: boolean }) => {
						if (synced) setStatus('connected');
					});

					provider.on('peers', ({ webrtcPeers }: { webrtcPeers: any[] }) => {
						if (webrtcPeers.length > 0) {
							setStatus('connected');
						} else if (currentStatus === 'connected') {
							// Lost all peers — back to waiting
							setStatus('connecting');
						}
					});

					// After signaling setup, mark as "waiting" (not fake "connected")
					// Status stays 'connecting' until an actual peer connects
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
