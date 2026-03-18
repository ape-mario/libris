import { createProvider } from './base';
import type { SyncProvider } from './provider';

const PARTYKIT_HOST =
	(typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PARTYKIT_HOST) ||
	'localhost:1999';

export function createPartyKitProvider(): SyncProvider {
	return createProvider(async (doc, roomCode, setStatus) => {
		const YPartyKitProvider = (await import('y-partykit/provider')).default;
		const provider = new YPartyKitProvider(PARTYKIT_HOST, roomCode, doc, { connect: true });

		provider.on('sync', (synced: boolean) => {
			if (synced) setStatus('connected');
		});
		provider.on('connection-close', () => {
			setStatus(navigator.onLine ? 'connecting' : 'offline');
		});
		provider.on('connection-error', () => {
			setStatus('disconnected');
		});

		return { destroy: () => provider.destroy() };
	});
}
