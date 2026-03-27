<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { onDetected }: { onDetected: (code: string) => void } = $props();
  let videoRef: HTMLVideoElement;
  let stream: MediaStream | null = null;
  let active = $state(false);
  let error = $state('');
  let loading = $state(true);
  let animationId: number | null = null;

  onMount(async () => {
    // Check for native BarcodeDetector support
    const hasNative = 'BarcodeDetector' in window;

    try {
      // Request high-res camera with continuous autofocus
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
          ...(({ focusMode: 'continuous', focusDistance: 0 }) as any)
        },
        audio: false
      });

      videoRef.srcObject = stream;
      await videoRef.play();
      active = true;
      loading = false;

      // Try to force continuous autofocus on the track
      const track = stream.getVideoTracks()[0];
      if (track) {
        try {
          const capabilities = track.getCapabilities() as any;
          if (capabilities?.focusMode?.includes('continuous')) {
            await (track as any).applyConstraints({ advanced: [{ focusMode: 'continuous' }] });
          }
        } catch { /* not all browsers support this */ }
      }

      if (hasNative) {
        // Use native BarcodeDetector — fast, accurate
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e']
        });

        const scan = async () => {
          if (!active) return;
          try {
            const barcodes = await detector.detect(videoRef);
            if (barcodes.length > 0) {
              const code = barcodes[0].rawValue;
              if (code) {
                cleanup();
                onDetected(code);
                return;
              }
            }
          } catch { /* frame not ready */ }
          animationId = requestAnimationFrame(scan);
        };
        animationId = requestAnimationFrame(scan);
      } else {
        // Fallback: QuaggaJS for browsers without BarcodeDetector
        const Quagga = (await import('@ericblade/quagga2')).default;

        // Create offscreen canvas for QuaggaJS processing
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d')!;

        const scan = () => {
          if (!active) return;
          canvas.width = videoRef.videoWidth;
          canvas.height = videoRef.videoHeight;
          ctx.drawImage(videoRef, 0, 0);

          Quagga.decodeSingle(
            {
              src: canvas.toDataURL('image/jpeg'),
              numOfWorkers: 0,
              decoder: { readers: ['ean_reader', 'ean_8_reader', 'upc_reader'] },
              locate: true
            },
            (result: any) => {
              const code = result?.codeResult?.code;
              if (code) {
                cleanup();
                onDetected(code);
                return;
              }
              if (active) animationId = requestAnimationFrame(scan);
            }
          );
        };
        // Scan every 500ms instead of every frame (QuaggaJS is slow)
        const intervalScan = () => {
          if (!active) return;
          scan();
          setTimeout(() => { if (active) intervalScan(); }, 500);
        };
        intervalScan();
      }
    } catch (e) {
      error = t('scanner.error');
      loading = false;
    }
  });

  function cleanup() {
    active = false;
    if (animationId) cancelAnimationFrame(animationId);
    if (stream) {
      stream.getTracks().forEach(t => t.stop());
      stream = null;
    }
  }

  onDestroy(cleanup);
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
    <video
      bind:this={videoRef}
      class="w-full aspect-[4/3] object-cover"
      playsinline
      muted
      autoplay
    ></video>

    <!-- Scanning overlay -->
    <div class="absolute inset-0 pointer-events-none">
      <!-- Dimmed edges -->
      <div class="absolute inset-0 border-[40px] border-ink/40 rounded-xl"></div>

      <!-- Corner markers -->
      <div class="absolute top-5 left-5 w-12 h-12 border-t-3 border-l-3 border-accent rounded-tl-xl"></div>
      <div class="absolute top-5 right-5 w-12 h-12 border-t-3 border-r-3 border-accent rounded-tr-xl"></div>
      <div class="absolute bottom-5 left-5 w-12 h-12 border-b-3 border-l-3 border-accent rounded-bl-xl"></div>
      <div class="absolute bottom-5 right-5 w-12 h-12 border-b-3 border-r-3 border-accent rounded-br-xl"></div>

      <!-- Scanning line -->
      {#if active}
        <div class="scan-line absolute left-7 right-7 h-0.5 bg-accent rounded-full shadow-[0_0_8px_var(--color-accent)]"></div>
      {/if}

      <!-- Loading -->
      {#if loading}
        <div class="absolute inset-0 flex items-center justify-center bg-ink/70">
          <div class="flex flex-col items-center gap-3">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-warm-300 animate-pulse"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="M2 9h20"/></svg>
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
  .scan-line {
    animation: scanMove 2s ease-in-out infinite;
  }
  @keyframes scanMove {
    0%, 100% { top: 20%; }
    50% { top: 75%; }
  }
</style>
