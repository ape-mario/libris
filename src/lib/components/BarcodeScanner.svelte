<script lang="ts">
  import Quagga from '@ericblade/quagga2';
  import { onMount, onDestroy } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { onDetected }: { onDetected: (code: string) => void } = $props();
  let scannerRef: HTMLDivElement;
  let active = $state(false);
  let error = $state('');
  let scanning = $state(true);

  onMount(() => {
    Quagga.init(
      {
        inputStream: {
          type: 'LiveStream',
          target: scannerRef,
          constraints: {
            facingMode: 'environment',
            width: { min: 1280, ideal: 1920 },
            height: { min: 720, ideal: 1080 },
            ...({ focusMode: 'continuous' } as any)
          }
        },
        locate: true,
        frequency: 10,
        decoder: {
          readers: ['ean_reader', 'ean_8_reader', 'upc_reader'],
          multiple: false
        }
      },
      (err: any) => {
        if (err) {
          error = t('scanner.error');
          scanning = false;
          return;
        }
        Quagga.start();
        active = true;
        scanning = false;
      }
    );

    Quagga.onDetected((result: any) => {
      const code = result.codeResult?.code;
      const errors = result.codeResult?.decodedCodes
        ?.filter((d: any) => d.error != null)
        ?.map((d: any) => d.error) || [];
      const avgError = errors.length > 0 ? errors.reduce((a: number, b: number) => a + b, 0) / errors.length : 1;

      if (code && avgError < 0.15) {
        Quagga.stop();
        active = false;
        onDetected(code);
      }
    });
  });

  onDestroy(() => {
    if (active) Quagga.stop();
  });
</script>

<div class="relative animate-fade-in">
  {#if error}
    <div class="card p-4 mb-3 border-berry/20 bg-berry/5">
      <div class="flex items-center gap-3">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-berry flex-shrink-0"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>
        <p class="text-berry text-sm font-medium">{error}</p>
      </div>
    </div>
  {/if}

  <div class="relative rounded-xl overflow-hidden bg-ink">
    <!-- Camera viewfinder -->
    <div bind:this={scannerRef} class="scanner-viewfinder w-full aspect-[4/3]"></div>

    <!-- Scanning overlay -->
    <div class="absolute inset-0 pointer-events-none">
      <!-- Corner markers -->
      <div class="absolute top-6 left-6 w-10 h-10 border-t-2 border-l-2 border-accent rounded-tl-lg"></div>
      <div class="absolute top-6 right-6 w-10 h-10 border-t-2 border-r-2 border-accent rounded-tr-lg"></div>
      <div class="absolute bottom-6 left-6 w-10 h-10 border-b-2 border-l-2 border-accent rounded-bl-lg"></div>
      <div class="absolute bottom-6 right-6 w-10 h-10 border-b-2 border-r-2 border-accent rounded-br-lg"></div>

      <!-- Scanning line animation -->
      {#if active}
        <div class="scan-line absolute left-8 right-8 h-0.5 bg-accent/80 rounded-full"></div>
      {/if}

      <!-- Loading state -->
      {#if scanning}
        <div class="absolute inset-0 flex items-center justify-center bg-ink/60">
          <div class="flex flex-col items-center gap-2">
            <div class="w-8 h-0.5 bg-warm-300 rounded-full animate-pulse"></div>
            <span class="text-xs text-warm-300">{t('scanner.loading')}</span>
          </div>
        </div>
      {/if}
    </div>
  </div>

  <div class="flex items-center justify-center gap-2 mt-3">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-warm-400"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/></svg>
    <p class="text-xs text-ink-muted">{t('scanner.hint')}</p>
  </div>
</div>

<style>
  .scanner-viewfinder :global(video) {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
  .scanner-viewfinder :global(canvas) {
    display: none;
  }
  .scan-line {
    animation: scanMove 2s ease-in-out infinite;
  }
  @keyframes scanMove {
    0%, 100% { top: 20%; }
    50% { top: 75%; }
  }
</style>
