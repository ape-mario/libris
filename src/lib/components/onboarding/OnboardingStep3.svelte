<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  let { onDone }: { onDone: () => void } = $props();

  let step3Mode = $state<'choose' | 'sync' | 'done'>('choose');
  let syncPassword = $state('');
  let createdRoomCode = $state('');

  // Create room
  async function handleCreateRoom() {
    const { createRoom } = await import('$lib/sync/manager');
    const code = createRoom(syncPassword || undefined);
    createdRoomCode = code;
    step3Mode = 'done';
  }
</script>

<h2 class="font-display text-xl font-bold text-ink tracking-tight text-center mb-6">
  {t('onboarding.step3.title')}
</h2>

{#if step3Mode === 'choose'}
  <div class="space-y-3">
    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={() => { step3Mode = 'sync'; }}
    >
      <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-accent"><path d="M4 12l1.5-1.5M20 12l-1.5-1.5"/><path d="M12 4l-1.5 1.5M12 20l1.5-1.5"/><path d="M17.66 17.66l-1.06-1.06M6.34 6.34l-1.06-1.06"/><path d="M6.34 17.66l1.06-1.06M17.66 6.34l-1.06-1.06"/><circle cx="12" cy="12" r="3"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step3.setup')}</p>
        <p class="text-xs text-ink-muted">{t('onboarding.step3.setup_desc')}</p>
      </div>
    </button>

    <button
      class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left"
      onclick={onDone}
    >
      <div class="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" class="text-ink-muted"><path d="M5 12h14"/><path d="m12 5 7 7-7 7"/></svg>
      </div>
      <div class="min-w-0">
        <p class="font-semibold text-ink text-sm">{t('onboarding.step3.skip')}</p>
      </div>
    </button>
  </div>

{:else if step3Mode === 'sync'}
  <div class="space-y-4">
    <label class="flex flex-col gap-1.5">
      <span class="text-xs text-ink-muted">{t('settings.sync_password')}</span>
      <input
        type="password"
        bind:value={syncPassword}
        placeholder={t('settings.sync_password_placeholder')}
        class="input-field !py-2 text-sm"
      />
    </label>
    <button class="btn-primary w-full" onclick={handleCreateRoom}>
      {t('settings.sync_create_room')}
    </button>
    <button class="text-sm text-ink-muted hover:text-ink transition-colors" onclick={() => { step3Mode = 'choose'; }}>
      {t('onboarding.back')}
    </button>
  </div>

{:else if step3Mode === 'done'}
  <div class="text-center space-y-4">
    <div class="w-16 h-16 rounded-2xl bg-sage/10 mx-auto flex items-center justify-center">
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="text-sage"><path d="M20 6 9 17l-5-5"/></svg>
    </div>
    <p class="font-display text-lg font-semibold text-ink">
      {t('onboarding.step3.room_created')}
    </p>
    <div class="bg-warm-50 rounded-xl p-4">
      <span class="text-xs text-ink-muted uppercase tracking-wider font-semibold">{t('settings.sync_room_code')}</span>
      <p class="font-mono text-2xl font-bold text-ink tracking-widest mt-1">{createdRoomCode}</p>
    </div>
    <button class="btn-primary" onclick={onDone}>{t('onboarding.done')}</button>
  </div>
{/if}
