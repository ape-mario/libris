<script lang="ts">
  import Quagga from '@ericblade/quagga2';
  import { onMount, onDestroy } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { onDetected }: { onDetected: (code: string) => void } = $props();
  let scannerRef: HTMLDivElement;
  let active = $state(false);
  let error = $state('');

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
          return;
        }
        Quagga.start();
        active = true;
      }
    );

    Quagga.onDetected((result: any) => {
      const code = result.codeResult?.code;
      const errors = result.codeResult?.decodedCodes
        ?.filter((d: any) => d.error != null)
        ?.map((d: any) => d.error) || [];
      const avgError = errors.length > 0 ? errors.reduce((a: number, b: number) => a + b, 0) / errors.length : 1;

      // Only accept reads with low error rate (high confidence)
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
    <div class="card p-4 mb-3 border-berry/20">
      <p class="text-berry text-sm font-medium">{error}</p>
    </div>
  {/if}
  <div bind:this={scannerRef} class="w-full rounded-xl overflow-hidden bg-warm-900 aspect-video"></div>
  <p class="text-center text-xs text-ink-muted mt-3">{t('scanner.hint')}</p>
</div>
