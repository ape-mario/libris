<script lang="ts">
  import { onDestroy, tick } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { onDetected, onError }: { onDetected: (code: string) => void; onError?: () => void } = $props();

  let error = $state('');
  let scanning = $state(false);
  let manualISBN = $state('');
  let showManual = $state(false);
  let Html5QrcodeClass: any = null;
  let scannerInstance: any = null;

  // Load library eagerly but don't create instance yet
  import('html5-qrcode').then(mod => {
    Html5QrcodeClass = mod.Html5Qrcode;
  }).catch(() => {
    console.error('[Libris] Failed to load html5-qrcode');
  });

  async function startCamera() {
    error = '';

    if (!Html5QrcodeClass) {
      error = t('scanner.camera_error');
      return;
    }

    scanning = true;
    await tick();

    try {
      // Create fresh instance each time (element must exist in DOM now)
      scannerInstance = new Html5QrcodeClass('barcode-scanner-region');

      await scannerInstance.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: 120 },
          aspectRatio: 1.333,
          disableFlip: false
        },
        (decodedText: string) => {
          stopCamera();
          onDetected(decodedText);
        },
        () => { /* scanning frame, no result yet */ }
      );
    } catch (e: any) {
      scanning = false;
      scannerInstance = null;
      const msg = String(e?.message || e || '');
      if (msg.includes('Permission') || msg.includes('NotAllowed')) {
        error = t('scanner.error');
      } else {
        error = t('scanner.camera_error') + ' (' + msg.slice(0, 80) + ')';
      }
    }
  }

  async function stopCamera() {
    if (scannerInstance) {
      try {
        const state = scannerInstance.getState();
        if (state === 2) { // SCANNING
          await scannerInstance.stop();
        }
      } catch { /* already stopped */ }
      try { scannerInstance.clear(); } catch {}
      scannerInstance = null;
    }
    scanning = false;
  }

  async function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    error = '';

    // Try html5-qrcode scanFile (needs instance)
    if (Html5QrcodeClass) {
      try {
        const tempScanner = new Html5QrcodeClass('barcode-scanner-region');
        const result = await tempScanner.scanFile(file, false);
        tempScanner.clear();
        if (result) {
          onDetected(result);
          input.value = '';
          return;
        }
      } catch { /* no barcode found via html5-qrcode */ }
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
      } catch { /* native fallback failed */ }
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

  onDestroy(() => {
    stopCamera();
  });
</script>

<div class="animate-fade-in flex flex-col gap-4">
  {#if error}
    <div class="card p-3 border-berry/20 bg-berry/5">
      <p class="text-berry text-sm">{error}</p>
    </div>
  {/if}

  <!-- Scanner div: always in DOM, hidden when not scanning -->
  <div id="barcode-scanner-region" class="rounded-xl overflow-hidden {scanning ? '' : 'hidden'}"></div>

  {#if showManual}
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
    <button class="btn-secondary text-sm w-full" onclick={stopCamera}>
      {t('scanner.stop_camera')}
    </button>
  {:else}
    <!-- 1. Photo (primary — native camera, always works) -->
    <label class="card p-5 flex items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
      <div class="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
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

    <!-- 2. Gallery -->
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

    <!-- 3. Manual ISBN -->
    <button class="card p-4 flex items-center gap-4 hover:shadow-md transition-shadow w-full text-left" onclick={() => showManual = true}>
      <div class="w-10 h-10 rounded-xl bg-warm-100 flex items-center justify-center text-warm-400 flex-shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
      </div>
      <div>
        <p class="text-sm font-medium text-ink">{t('scanner.type_isbn')}</p>
        <p class="text-xs text-ink-muted">{t('scanner.type_isbn_desc')}</p>
      </div>
    </button>

    <!-- 4. Live scan (last — may be blurry on some phones) -->
    <button class="text-center text-xs text-warm-400 hover:text-ink-muted py-3 px-4 min-h-[44px]" onclick={startCamera}>
      {t('scanner.live_scan')}
    </button>
  {/if}
</div>
