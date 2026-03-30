<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    dnfReason?: string;
    dnfPage?: number;
    onUpdate: (field: string, value: any) => void;
  }

  let { dnfReason, dnfPage, onUpdate }: Props = $props();
</script>

<div class="mb-6 animate-fade-up">
  <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.dnf')}</h2>
  <div class="card p-4 flex flex-col gap-3">
    <label class="flex flex-col gap-1">
      <span class="text-xs text-ink-muted">{t('book.dnf.reason')}</span>
      <textarea
        class="input-field resize-none h-16 text-sm"
        placeholder={t('book.dnf.reason_placeholder')}
        value={dnfReason || ''}
        onblur={(e) => onUpdate('dnfReason', (e.target as HTMLTextAreaElement).value || undefined)}
      ></textarea>
    </label>
    <label class="flex flex-col gap-1 w-40">
      <span class="text-xs text-ink-muted">{t('book.dnf.stopped_at')}</span>
      <input
        type="number"
        min="1"
        value={dnfPage || ''}
        onblur={(e) => onUpdate('dnfPage', parseInt((e.target as HTMLInputElement).value) || undefined)}
        class="input-field !py-1.5 text-sm"
        placeholder={t('book.dnf.page_placeholder')}
      />
    </label>
  </div>
</div>
