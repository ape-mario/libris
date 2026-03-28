<script lang="ts">
  import { onMount, onDestroy, tick } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { onDetected, onError }: { onDetected: (code: string) => void; onError?: () => void } = $props();

  let scannerRef: HTMLDivElement;
  let error = $state('');
  let scanning = $state(false);
  let manualISBN = $state('');
  let showManual = $state(false);
  let scanner: any = null;

  onMount(async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      scanner = new Html5Qrcode('barcode-scanner-region');
    } catch (e) {
      console.error('[Libris] Failed to init scanner:', e);
    }
  });

  onDestroy(() => {
    if (scanner) {
      try { scanner.stop().catch(() => {}); } catch {}
      try { scanner.clear(); } catch {}
    }
  });

  async function startCamera() {
    if (!scanner) return;
    error = '';
    scanning = true;
    await tick(); // wait for DOM to render the scanner div

    try {
      await scanner.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 120 },
          aspectRatio: 1.333
        },
        (decodedText: string) => {
          // Success — stop and report
          scanner.stop().catch(() => {});
          scanning = false;
          onDetected(decodedText);
        },
        () => {
          // Scan frame — no result yet, keep scanning
        }
      );
    } catch (e: any) {
      scanning = false;
      error = e?.message?.includes('Permission') ? t('scanner.error') : t('scanner.camera_error');
      onError?.();
    }
  }

  function stopCamera() {
    if (scanner) {
      scanner.stop().catch(() => {});
    }
    scanning = false;
  }

  async function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file || !scanner) {
      input.value = '';
      return;
    }

    error = '';

    try {
      const result = await scanner.scanFile(file, true);
      if (result) {
        onDetected(result);
        input.value = '';
        return;
      }
    } catch {
      // scanFile throws if no barcode found
    }

    // Try native BarcodeDetector as fallback
    if ('BarcodeDetector' in window) {
      try {
        const img = await createImageBitmap(file);
        const detector = new (window as any).BarcodeDetector({
          formats: ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39']
        });
        const barcodes = await detector.detect(img);
        if (barcodes.length > 0 && barcodes[0].rawValue) {
          onDetected(barcodes[0].rawValue);
          input.value = '';
          return;
        }
      } catch { /* fallback failed */ }
    }

    error = t('scanner.no_barcode');
    onError?.();
    input.value = '';
  }

  function handleManualSubmit() {
    const cleaned = manualISBN.replace(/[^0-9Xx]/g, '').trim();
    if (cleaned.length >= 10) {
      onDetected(cleaned);
    }
  }
</script>

<div class="animate-fade-in flex flex-col gap-4">
  {#if error}
    <div class="card p-3 border-berry/20 bg-berry/5">
      <p class="text-berry text-sm">{error}</p>
    </div>
  {/if}

  {#if showManual}
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
  {:else if scanning}
    <!-- Live camera scanner -->
    <div class="relative rounded-xl overflow-hidden bg-ink">
      <div id="barcode-scanner-region" class="w-full"></div>
    </div>
    <button class="btn-secondary text-sm w-full" onclick={stopCamera}>
      {t('scanner.stop_camera')}
    </button>
  {:else}
    <!-- Action buttons -->
    <button class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer w-full text-left" onclick={startCamera}>
      <div class="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
          <rect x="2" y="4" width="20" height="16" rx="2"/>
          <path d="M7 15V9"/><path d="M12 15V9"/><path d="M17 15V9"/>
        </svg>
      </div>
      <div>
        <p class="font-display text-sm font-semibold text-ink">{t('scanner.live_scan')}</p>
        <p class="text-xs text-ink-muted">{t('scanner.live_scan_desc')}</p>
      </div>
    </button>

    <label class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
      <div class="w-12 h-12 rounded-xl bg-sage/10 flex items-center justify-center flex-shrink-0">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-sage">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </div>
      <div>
        <p class="font-display text-sm font-semibold text-ink">{t('scanner.take_photo')}</p>
        <p class="text-xs text-ink-muted">{t('scanner.take_photo_desc')}</p>
      </div>
      <input type="file" accept="image/*" capture="environment" class="hidden" onchange={handleFileInput} />
    </label>

    <label class="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
      <div class="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center text-warm-400 flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/></svg>
      </div>
      <div>
        <p class="text-sm font-medium text-ink">{t('scanner.from_gallery')}</p>
        <p class="text-xs text-ink-muted">{t('scanner.from_gallery_desc')}</p>
      </div>
      <input type="file" accept="image/*" class="hidden" onchange={handleFileInput} />
    </label>

    <button class="text-center text-xs text-accent hover:text-accent-dark py-2" onclick={() => showManual = true}>
      {t('scanner.type_isbn')}
    </button>
  {/if}
</div>
