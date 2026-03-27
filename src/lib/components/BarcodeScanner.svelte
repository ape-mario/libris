<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { onDetected }: { onDetected: (code: string) => void } = $props();

  let mode = $state<'choose' | 'live' | 'photo'>('choose');
  let videoRef: HTMLVideoElement;
  let stream: MediaStream | null = null;
  let active = $state(false);
  let error = $state('');
  let loading = $state(false);
  let processing = $state(false);
  let animationId: number | null = null;

  function cleanup() {
    active = false;
    if (animationId) cancelAnimationFrame(animationId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  onDestroy(cleanup);

  // === PHOTO MODE: use native camera app ===
  async function handlePhoto(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    processing = true;
    error = '';

    try {
      const img = await createImageBitmap(file);

      // Try native BarcodeDetector first
      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
        });
        const barcodes = await detector.detect(img);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          processing = false;
          onDetected(barcodes[0].rawValue);
          return;
        }
      }

      // Fallback: QuaggaJS
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      canvas.getContext('2d')!.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.9);

      const Quagga = (await import('@ericblade/quagga2')).default;
      Quagga.decodeSingle(
        {
          src: dataUrl,
          numOfWorkers: 0,
          decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader'] },
          locate: true
        },
        (result: any) => {
          processing = false;
          const code = result?.codeResult?.code;
          if (code) {
            onDetected(code);
          } else {
            error = t('scanner.no_barcode');
          }
        }
      );
    } catch {
      processing = false;
      error = t('scanner.no_barcode');
    }

    input.value = '';
  }

  // === LIVE MODE: getUserMedia + BarcodeDetector ===
  async function startLive() {
    mode = 'live';
    loading = true;
    error = '';

    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 }
        },
        audio: false
      });

      videoRef.srcObject = stream;
      await videoRef.play();
      active = true;
      loading = false;

      // Try to force continuous autofocus
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          await (track as any).applyConstraints({
            advanced: [{ focusMode: 'continuous' } as any]
          });
        } catch { /* not supported */ }
      }

      if ('BarcodeDetector' in window) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
        });
        const scan = async () => {
          if (!active) return;
          try {
            const barcodes = await detector.detect(videoRef);
            if (barcodes.length > 0 && barcodes[0].rawValue) {
              cleanup();
              onDetected(barcodes[0].rawValue);
              return;
            }
          } catch { /* frame not ready */ }
          animationId = requestAnimationFrame(scan);
        };
        animationId = requestAnimationFrame(scan);
      } else {
        // No native API — suggest photo mode
        error = t('scanner.use_photo');
      }
    } catch {
      error = t('scanner.error');
      loading = false;
    }
  }
</script>

<div class="relative animate-fade-in">
  {#if error}
    <div class="card p-3 mb-3 border-berry/20 bg-berry/5">
      <p class="text-berry text-sm">{error}</p>
    </div>
  {/if}

  {#if mode === 'choose'}
    <!-- Mode selection -->
    <div class="flex flex-col gap-3">
      <label class="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
        <div class="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center text-accent flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
        </div>
        <div class="flex-1">
          <div class="text-sm font-semibold text-ink">{t('scanner.photo_mode')}</div>
          <div class="text-xs text-ink-muted">{t('scanner.photo_desc')}</div>
        </div>
        <input type="file" accept="image/*" capture="environment" class="hidden" onchange={handlePhoto} />
      </label>

      <button class="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow text-left w-full" onclick={startLive}>
        <div class="w-10 h-10 rounded-xl bg-sage/10 flex items-center justify-center text-sage flex-shrink-0">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/></svg>
        </div>
        <div class="flex-1">
          <div class="text-sm font-semibold text-ink">{t('scanner.live_mode')}</div>
          <div class="text-xs text-ink-muted">{t('scanner.live_desc')}</div>
        </div>
      </button>
    </div>
  {/if}

  {#if mode === 'photo'}
    {#if processing}
      <div class="card p-8 text-center">
        <div class="w-8 h-0.5 bg-warm-300 rounded-full animate-pulse mx-auto mb-3"></div>
        <p class="text-xs text-ink-muted">{t('scanner.processing')}</p>
      </div>
    {/if}
  {/if}

  {#if mode === 'live'}
    <div class="relative rounded-xl overflow-hidden bg-ink">
      <video bind:this={videoRef} class="w-full aspect-[4/3] object-cover" playsinline muted autoplay></video>

      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute inset-0 border-[40px] border-ink/40 rounded-xl"></div>
        <div class="absolute top-5 left-5 w-12 h-12 border-t-3 border-l-3 border-accent rounded-tl-xl"></div>
        <div class="absolute top-5 right-5 w-12 h-12 border-t-3 border-r-3 border-accent rounded-tr-xl"></div>
        <div class="absolute bottom-5 left-5 w-12 h-12 border-b-3 border-l-3 border-accent rounded-bl-xl"></div>
        <div class="absolute bottom-5 right-5 w-12 h-12 border-b-3 border-r-3 border-accent rounded-br-xl"></div>

        {#if active}
          <div class="scan-line absolute left-7 right-7 h-0.5 bg-accent rounded-full shadow-[0_0_8px_var(--color-accent)]"></div>
        {/if}

        {#if loading}
          <div class="absolute inset-0 flex items-center justify-center bg-ink/70">
            <div class="flex flex-col items-center gap-3">
              <div class="w-8 h-0.5 bg-warm-300 rounded-full animate-pulse"></div>
              <span class="text-xs text-warm-300">{t('scanner.loading')}</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Switch to photo mode button -->
      <button
        class="absolute bottom-3 right-3 z-10 text-[10px] text-warm-300 bg-ink/60 px-2 py-1 rounded-lg hover:bg-ink/80 transition-colors"
        onclick={() => { cleanup(); mode = 'choose'; }}
      >{t('scanner.switch_photo')}</button>
    </div>
  {/if}

  <div class="flex items-center justify-center gap-2 mt-3">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-warm-400"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/></svg>
    <p class="text-xs text-ink-muted">{t('scanner.hint')}</p>
  </div>
</div>

<style>
  .scan-line {
    animation: scanMove 2s ease-in-out infinite;
  }
  @keyframes scanMove {
    0%, 100% { top: 20%; }
    50% { top: 75%; }
  }
</style>
