<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';
  import OnboardingStep1 from '$lib/components/onboarding/OnboardingStep1.svelte';
  import OnboardingStep2 from '$lib/components/onboarding/OnboardingStep2.svelte';
  import OnboardingStep3 from '$lib/components/onboarding/OnboardingStep3.svelte';

  let { onComplete }: { onComplete: () => void } = $props();

  let step = $state(0);
  let importedCount = $state(0);
  let direction = $state<'left' | 'right'>('left');

  function goTo(newStep: number) {
    direction = newStep > step ? 'left' : 'right';
    step = newStep;
  }

  function goNext() {
    if (step < 2) {
      goTo(step + 1);
    } else {
      onComplete();
    }
  }

  function goBack() {
    if (step > 0) goTo(step - 1);
  }

  // Auto-skip step 2 if books were imported in step 1
  $effect(() => {
    if (step === 1 && importedCount > 0) {
      goTo(2);
    }
  });
</script>

<div class="fixed inset-0 z-[300] bg-cream flex items-center justify-center">
  <div class="max-w-lg w-full px-6 relative">
    <!-- Back button -->
    {#if step > 0}
      <button
        class="mb-2 flex items-center gap-1 text-sm text-ink-muted hover:text-ink transition-colors"
        onclick={goBack}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>
        {t('onboarding.back')}
      </button>
    {/if}

    <!-- Progress dots -->
    <div class="flex justify-center gap-2 mb-8">
      {#each [0, 1, 2] as i}
        <button
          class="w-2.5 h-2.5 rounded-full transition-colors {i === step ? 'bg-accent' : 'bg-warm-200'}"
          onclick={() => goTo(i)}
          aria-label="Step {i + 1}"
        ></button>
      {/each}
    </div>

    <!-- Steps -->
    <div class="animate-fade-up" class:slide-left={direction === 'left'} class:slide-right={direction === 'right'}>
      {#if step === 0}
        <OnboardingStep1 onImported={(count) => { importedCount = count; goNext(); }} onSkip={goNext} />
      {:else if step === 1}
        <OnboardingStep2 {importedCount} onDone={goNext} />
      {:else if step === 2}
        <OnboardingStep3 onDone={onComplete} />
      {/if}
    </div>

    <!-- Skip link -->
    {#if step < 2}
      <div class="text-center mt-8">
        <button class="text-sm text-ink-muted hover:text-ink transition-colors" onclick={() => goNext()}>
          {t('onboarding.skip')}
        </button>
      </div>
    {:else}
      <div class="text-center mt-8">
        <button class="text-sm text-ink-muted hover:text-ink transition-colors" onclick={onComplete}>
          {t('onboarding.skip')}
        </button>
      </div>
    {/if}
  </div>
</div>
