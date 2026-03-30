import { describe, it, expect } from 'vitest';
import {
	generateRoomCode,
	isValidRoomCode,
	formatRoomCode,
	parseRoomCodeFromUrl,
	getRoomLink,
	parsePasswordFromUrl
} from './room';

describe('Room codes', () => {
	it('generates 8-character code in XXXX-XXXX format', () => {
		const code = generateRoomCode();
		expect(code).toMatch(/^[A-Z2-9]{4}-[A-Z2-9]{4}$/);
	});

	it('excludes ambiguous characters (0, O, 1, I, L)', () => {
		for (let i = 0; i < 100; i++) {
			const code = generateRoomCode();
			expect(code).not.toMatch(/[01OIL]/);
		}
	});

	it('validates correct format', () => {
		expect(isValidRoomCode('ABCD-EF23')).toBe(true);
		expect(isValidRoomCode('abcd-ef23')).toBe(true);
		expect(isValidRoomCode('ABC')).toBe(false);
		expect(isValidRoomCode('ABCD-EFGI')).toBe(false); // I is ambiguous
	});

	it('handles multiple dashes in validation', () => {
		expect(isValidRoomCode('AB-CD-EF-23')).toBe(true); // 8 valid chars after removing dashes
	});

	it('formats room code to uppercase with dash', () => {
		expect(formatRoomCode('abcdef23')).toBe('ABCD-EF23');
		expect(formatRoomCode('ABCD-EF23')).toBe('ABCD-EF23');
	});

	it('parseRoomCodeFromUrl extracts valid code', () => {
		const code = parseRoomCodeFromUrl('https://libris.app/join/ABCD-EF23');
		expect(code).toBe('ABCD-EF23');
	});

	it('parseRoomCodeFromUrl works with base path', () => {
		const code = parseRoomCodeFromUrl('https://user.github.io/libris/join/ABCD-EF23');
		expect(code).toBe('ABCD-EF23');
	});

	it('parseRoomCodeFromUrl returns null for invalid URL', () => {
		expect(parseRoomCodeFromUrl('https://libris.app/settings')).toBeNull();
		expect(parseRoomCodeFromUrl('not-a-url')).toBeNull();
	});
});

describe('Room links and passwords', () => {
	it('getRoomLink includes password as hash fragment', () => {
		// Mock window.location.origin
		const origLocation = globalThis.window?.location;
		Object.defineProperty(globalThis, 'window', {
			value: { location: { origin: 'https://example.com' } },
			writable: true,
			configurable: true
		});
		const link = getRoomLink('ABCD-EF23', '/libris', 'secret123');
		expect(link).toContain('#pw=secret123');
		expect(link).toContain('/join/ABCD-EF23');
		// Restore
		if (origLocation) {
			Object.defineProperty(globalThis, 'window', { value: { location: origLocation }, writable: true, configurable: true });
		}
	});

	it('getRoomLink without password has no hash', () => {
		Object.defineProperty(globalThis, 'window', {
			value: { location: { origin: 'https://example.com' } },
			writable: true,
			configurable: true
		});
		const link = getRoomLink('ABCD-EF23', '/libris');
		expect(link).not.toContain('#');
	});

	it('parsePasswordFromUrl extracts password from hash', () => {
		const pw = parsePasswordFromUrl('https://example.com/join/ABCD-EF23#pw=secret123');
		expect(pw).toBe('secret123');
	});

	it('parsePasswordFromUrl returns null without password', () => {
		const pw = parsePasswordFromUrl('https://example.com/join/ABCD-EF23');
		expect(pw).toBeNull();
	});
});
