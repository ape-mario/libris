<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { onDetected }: { onDetected: (code: string) => void } = $props();

  let videoRef: HTMLVideoElement;
  let canvasRef: HTMLCanvasElement;
  let stream: MediaStream | null = null;
  let track: MediaStreamTrack | null = null;
  let active = $state(false);
  let error = $state('');
  let loading = $state(true);
  let processing = $state(false);
  let torchOn = $state(false);
  let hasTorch = $state(false);
  let zoom = $state(1);
  let maxZoom = $state(1);
  let hasZoom = $state(false);
  let manualISBN = $state('');
  let showManual = $state(false);
  let autoScanning = $state(false);
  let animationId: number | null = null;
  let hasNativeDetector = $state(false);

  onMount(async () => {
    hasNativeDetector = 'BarcodeDetector' in window;

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
      track = stream.getVideoTracks()[0];
      active = true;
      loading = false;

      // Check capabilities
      if (track) {
        try {
          const caps = track.getCapabilities() as any;
          if (caps?.torch) hasTorch = true;
          if (caps?.zoom) {
            hasZoom = true;
            maxZoom = Math.min(caps.zoom.max, 5);
            zoom = 1;
          }
          // Try continuous autofocus
          if (caps?.focusMode?.includes('continuous')) {
            await (track as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch { /* not supported */ }
      }

      // Start auto-scanning if BarcodeDetector available
      if (hasNativeDetector) {
        startAutoScan();
      }
    } catch {
      error = t('scanner.error');
      loading = false;
    }
  });

  function startAutoScan() {
    if (!hasNativeDetector || autoScanning) return;
    autoScanning = true;
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
  }

  async function toggleTorch() {
    if (!track) return;
    torchOn = !torchOn;
    try {
      await (track as any).applyConstraints({ advanced: [{ torch: torchOn }] });
    } catch { torchOn = false; }
  }

  async function setZoom(value: number) {
    zoom = value;
    if (!track) return;
    try {
      await (track as any).applyConstraints({ advanced: [{ zoom: value }] });
    } catch { /* not supported */ }
  }

  async function captureFrame() {
    if (!active || processing) return;
    processing = true;
    error = '';

    const canvas = canvasRef;
    canvas.width = videoRef.videoWidth;
    canvas.height = videoRef.videoHeight;
    canvas.getContext('2d')!.drawImage(videoRef, 0, 0);

    try {
      // Try native BarcodeDetector on captured frame
      if (hasNativeDetector) {
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
        });
        const img = await createImageBitmap(canvas);
        const barcodes = await detector.detect(img);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          cleanup();
          onDetected(barcodes[0].rawValue);
          return;
        }
      }

      // Fallback: QuaggaJS
      const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
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
            cleanup();
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
  }

  function handleManualSubmit() {
    const cleaned = manualISBN.replace(/[^0-9Xx]/g, '').trim();
    if (cleaned.length >= 10) {
      cleanup();
      onDetected(cleaned);
    }
  }

  function cleanup() {
    active = false;
    autoScanning = false;
    if (animationId) cancelAnimationFrame(animationId);
    if (torchOn && track) {
      try { (track as any).applyConstraints({ advanced: [{ torch: false }] }); } catch {}
    }
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
      track = null;
    }
  }

  onDestroy(cleanup);
</script>

<div class="animate-fade-in">
  {#if error}
    <div class="card p-3 mb-3 border-berry/20 bg-berry/5">
      <p class="text-berry text-sm">{error}</p>
    </div>
  {/if}

  {#if !showManual}
    <div class="relative rounded-xl overflow-hidden bg-ink">
      <!-- Video -->
      <video bind:this={videoRef} class="w-full aspect-[4/3] object-cover" playsinline muted autoplay></video>
      <canvas bind:this={canvasRef} class="hidden"></canvas>

      <!-- Overlay -->
      <div class="absolute inset-0 pointer-events-none">
        <div class="absolute inset-0 border-[36px] border-ink/30"></div>
        <div class="absolute top-4 left-4 w-12 h-12 border-t-3 border-l-3 border-accent rounded-tl-xl"></div>
        <div class="absolute top-4 right-4 w-12 h-12 border-t-3 border-r-3 border-accent rounded-tr-xl"></div>
        <div class="absolute bottom-4 left-4 w-12 h-12 border-b-3 border-l-3 border-accent rounded-bl-xl"></div>
        <div class="absolute bottom-4 right-4 w-12 h-12 border-b-3 border-r-3 border-accent rounded-br-xl"></div>

        {#if active && !processing}
          <div class="scan-line absolute left-6 right-6 h-0.5 bg-accent rounded-full shadow-[0_0_8px_var(--color-accent)]"></div>
        {/if}

        {#if loading}
          <div class="absolute inset-0 flex items-center justify-center bg-ink/70">
            <div class="flex flex-col items-center gap-3">
              <div class="w-8 h-0.5 bg-warm-300 rounded-full animate-pulse"></div>
              <span class="text-xs text-warm-300">{t('scanner.loading')}</span>
            </div>
          </div>
        {/if}

        {#if processing}
          <div class="absolute inset-0 flex items-center justify-center bg-ink/50">
            <div class="flex flex-col items-center gap-2">
              <div class="w-8 h-0.5 bg-accent rounded-full animate-pulse"></div>
              <span class="text-xs text-warm-300">{t('scanner.processing')}</span>
            </div>
          </div>
        {/if}
      </div>

      <!-- Controls bar -->
      {#if active}
        <div class="absolute bottom-0 left-0 right-0 flex items-center justify-between px-3 py-2 bg-gradient-to-t from-ink/80 to-transparent">
          <!-- Torch -->
          <button
            class="w-9 h-9 rounded-full flex items-center justify-center transition-colors {hasTorch ? (torchOn ? 'bg-accent text-cream' : 'bg-ink/60 text-warm-300 hover:bg-ink/80') : 'opacity-30 pointer-events-none bg-ink/40 text-warm-500'}"
            onclick={toggleTorch}
            aria-label="Toggle torch"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 18h6"/><path d="M10 22h4"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>
          </button>

          <!-- Capture button -->
          <button
            class="w-14 h-14 rounded-full border-4 border-cream/80 bg-cream/20 hover:bg-cream/40 active:scale-90 transition-all flex items-center justify-center"
            onclick={captureFrame}
            disabled={processing}
            aria-label="Capture"
          >
            <div class="w-10 h-10 rounded-full bg-cream/90"></div>
          </button>

          <!-- Zoom -->
          {#if hasZoom}
            <button
              class="w-9 h-9 rounded-full bg-ink/60 text-warm-300 hover:bg-ink/80 flex items-center justify-center text-xs font-bold transition-colors"
              onclick={() => setZoom(zoom >= maxZoom ? 1 : Math.min(zoom + 0.5, maxZoom))}
              aria-label="Zoom"
            >
              {zoom.toFixed(1)}x
            </button>
          {:else}
            <div class="w-9"></div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Zoom slider -->
    {#if active && hasZoom}
      <div class="flex items-center gap-3 mt-2 px-1">
        <span class="text-[10px] text-warm-400">1x</span>
        <input
          type="range"
          min="1"
          max={maxZoom}
          step="0.1"
          value={zoom}
          oninput={(e) => setZoom(parseFloat((e.target as HTMLInputElement).value))}
          class="flex-1 accent-accent h-1"
        />
        <span class="text-[10px] text-warm-400">{maxZoom.toFixed(0)}x</span>
      </div>
    {/if}

    <div class="flex items-center justify-between mt-3">
      <div class="flex items-center gap-2">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-warm-400"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/></svg>
        <p class="text-xs text-ink-muted">{t('scanner.hint')}</p>
      </div>
      <button class="text-xs text-accent hover:text-accent-dark" onclick={() => showManual = true}>
        {t('scanner.type_isbn')}
      </button>
    </div>
  {:else}
    <!-- Manual ISBN input -->
    <div class="card p-5">
      <h3 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-3">{t('scanner.manual_title')}</h3>
      <form class="flex gap-2" onsubmit={(e) => { e.preventDefault(); handleManualSubmit(); }}>
        <input
          type="text"
          bind:value={manualISBN}
          placeholder="978..."
          class="input-field flex-1 font-mono"
          inputmode="numeric"
          autofocus
        />
        <button type="submit" class="btn-primary-sm" disabled={manualISBN.replace(/[^0-9]/g, '').length < 10}>
          {t('scanner.manual_submit')}
        </button>
      </form>
      <button class="text-xs text-accent hover:text-accent-dark mt-3" onclick={() => showManual = false}>
        {t('scanner.back_camera')}
      </button>
    </div>
  {/if}
</div>

<style>
  .scan-line {
    animation: scanMove 2s ease-in-out infinite;
  }
  @keyframes scanMove {
    0%, 100% { top: 20%; }
    50% { top: 75%; }
  }
  input[type="range"] {
    -webkit-appearance: none;
    appearance: none;
    background: var(--color-warm-200);
    border-radius: 9999px;
    height: 4px;
  }
  input[type="range"]::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--color-accent);
    cursor: pointer;
  }
</style>
