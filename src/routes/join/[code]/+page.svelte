<script lang="ts">
  import { page } from '$app/state';
  import { goto } from '$app/navigation';
  import { isValidRoomCode, formatRoomCode } from '$lib/sync/room';
  import { onMount } from 'svelte';

  onMount(() => {
    const code = formatRoomCode(page.params.code || '');
    if (!isValidRoomCode(code)) {
      goto('/settings');
      return;
    }
    // Store pending join code, Settings page will pick it up
    sessionStorage.setItem('libris_pending_join', code);
    goto('/settings');
  });
</script>
