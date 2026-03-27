import { createProvider } from './base';
import type { SyncProvider } from './provider';

const PARTYKIT_HOST =
	(typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_PARTYKIT_HOST) ||
	'localhost:1999';

export function createPartyKitProvider(password?: string): SyncProvider {
	return createProvider(async (doc, roomCode, setStatus) => {
		const YPartyKitProvider = (await import('y-partykit/provider')).default;
		const opts: Record<string, unknown> = { connect: true };
		if (password) opts.params = { password };
		const provider = new YPartyKitProvider(PARTYKIT_HOST, roomCode, doc, opts);

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
