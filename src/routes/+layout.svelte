<script lang="ts">
  import '../app.css';
  import { onMount } from 'svelte';
  import { getCurrentUser, restoreUser } from '$lib/stores/user.svelte';
  import ProfilePicker from '$lib/components/ProfilePicker.svelte';
  import TopBar from '$lib/components/TopBar.svelte';
  import BottomNav from '$lib/components/BottomNav.svelte';
  import Toast from '$lib/components/Toast.svelte';
  import Dialog from '$lib/components/Dialog.svelte';
  import { t } from '$lib/i18n/index.svelte';
  import { getLocale } from '$lib/i18n/index.svelte';
  import { cacheAllCovers } from '$lib/services/coverCache';
  import { initTheme } from '$lib/stores/theme.svelte';
  import { initDoc } from '$lib/db';
  import { page } from '$app/state';

  let { children } = $props();
  let loaded = $state(false);
  let initError = $state<string | null>(null);
  let user = $derived(getCurrentUser());
  let locale = $derived(getLocale());

  $effect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.lang = locale;
    }
  });

  onMount(async () => {
    initTheme();

    // Install global error handler
    const { installGlobalErrorHandler, logError } = await import('$lib/services/logger');
    installGlobalErrorHandler();

    // Initialize Y.Doc with IndexedDB persistence
    try {
      await initDoc();
    } catch (e) {
      logError('Failed to initialize database', { error: String(e) });
      initError = e instanceof DOMException && e.name === 'QuotaExceededError'
        ? 'Storage is full. Please free up space and reload.'
        : 'Failed to load your library. Please reload the page.';
      return;
    }

    // Run one-time Dexie→Yjs migration if needed
    try {
      const { migrateFromDexie, shouldCleanupDexie, cleanupDexie } = await import('$lib/db/migrate');
      await migrateFromDexie((await import('$lib/db')).doc);

      if (shouldCleanupDexie()) {
        await cleanupDexie();
      }
    } catch (e) {
      console.warn('[Libris] Migration check failed:', e);
    }

    // Handle /join/[code] URL or auto-reconnect to previous room.
    // Must happen before restoreUser so sync starts immediately.
    try {
      const { joinRoom, autoReconnect } = await import('$lib/sync/manager');
      const { isValidRoomCode, formatRoomCode } = await import('$lib/sync/room');

      const joinMatch = page.url.pathname.match(/\/join\/([A-Za-z2-9-]+)$/);
      if (joinMatch) {
        const code = formatRoomCode(joinMatch[1]);
        if (isValidRoomCode(code)) {
          joinRoom(code);
        }
      } else {
        autoReconnect();
      }
    } catch (e) {
      console.warn('[Libris] Sync setup failed:', e);
    }

    restoreUser();
    loaded = true;
    setTimeout(() => cacheAllCovers(), 3000);
  });
</script>

{#if initError}
  <div class="min-h-screen bg-cream flex items-center justify-center p-6">
    <div class="text-center max-w-sm">
      <div class="w-16 h-16 rounded-2xl bg-berry/10 mx-auto mb-4 flex items-center justify-center">
        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-berry"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
      </div>
      <p class="font-display text-lg text-ink font-semibold mb-2">Something went wrong</p>
      <p class="text-sm text-ink-muted mb-6">{initError}</p>
      <button class="btn-primary" onclick={() => location.reload()}>Reload</button>
    </div>
  </div>
{:else if !loaded}
  <div class="min-h-screen bg-cream flex items-center justify-center">
    <div class="animate-fade-in flex flex-col items-center gap-3">
      <span class="font-display text-2xl text-ink font-semibold tracking-tight">{t('app.name')}</span>
      <div class="w-8 h-0.5 bg-warm-300 rounded-full animate-pulse"></div>
    </div>
  </div>
{:else if !user}
  <ProfilePicker />
{:else}
  <TopBar />
  <main class="pt-20 pb-24 px-5 min-h-screen bg-cream max-w-2xl mx-auto noise-bg">
    {@render children()}
  </main>
  <BottomNav />
{/if}

<Toast />
<Dialog />
