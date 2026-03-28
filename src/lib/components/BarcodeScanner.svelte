<script lang="ts">
  import { onDestroy } from 'svelte';
  import { t } from '$lib/i18n/index.svelte';

  let { onDetected, onError }: { onDetected: (code: string) => void; onError?: () => void } = $props();

  let error = $state('');
  let processing = $state(false);
  let manualISBN = $state('');
  let showManual = $state(false);

  async function decodeImage(file: File | Blob) {
    processing = true;
    error = '';

    try {
      const img = await createImageBitmap(file);

      // Try native BarcodeDetector first (fast, accurate)
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
            onDetected(code);
          } else {
            error = t('scanner.no_barcode');
            onError?.();
          }
        }
      );
    } catch {
      processing = false;
      error = t('scanner.no_barcode');
      onError?.();
    }
  }

  function handleFileInput(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) decodeImage(file);
    input.value = '';
  }

  function handleManualSubmit() {
    const cleaned = manualISBN.replace(/[^0-9Xx]/g, '').trim();
    if (cleaned.length >= 10) {
      onDetected(cleaned);
    }
  }

  onDestroy(() => {});
</script>

<div class="animate-fade-in flex flex-col gap-4">
  {#if error}
    <div class="card p-3 border-berry/20 bg-berry/5">
      <p class="text-berry text-sm">{error}</p>
    </div>
  {/if}

  {#if processing}
    <div class="card p-8 text-center">
      <div class="w-8 h-0.5 bg-accent rounded-full animate-pulse mx-auto mb-3"></div>
      <p class="text-sm text-ink-muted">{t('scanner.processing')}</p>
    </div>
  {:else if !showManual}
    <!-- Primary: Take photo with native camera -->
    <label class="card p-6 flex flex-col items-center gap-4 hover:shadow-md transition-shadow cursor-pointer">
      <div class="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" class="text-accent">
          <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
          <circle cx="12" cy="13" r="4"/>
        </svg>
      </div>
      <div class="text-center">
        <p class="font-display text-sm font-semibold text-ink">{t('scanner.take_photo')}</p>
        <p class="text-xs text-ink-muted mt-0.5">{t('scanner.take_photo_desc')}</p>
      </div>
      <input type="file" accept="image/*" capture="environment" class="hidden" onchange={handleFileInput} />
    </label>

    <!-- Secondary: Pick from gallery -->
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

    <!-- Tertiary: Type ISBN -->
    <button class="text-center text-xs text-accent hover:text-accent-dark py-2" onclick={() => showManual = true}>
      {t('scanner.type_isbn')}
    </button>
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
