<script lang="ts">
  import { goto } from '$app/navigation';
  import { base } from '$app/paths';
  import { onMount } from 'svelte';

  // Room join is handled by +layout.svelte on initial load.
  // This page just redirects to settings.
  onMount(() => {
    goto(`${base}/settings`);
  });
</script>
