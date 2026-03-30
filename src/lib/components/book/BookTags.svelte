<script lang="ts">
  import { t } from '$lib/i18n/index.svelte';

  interface Props {
    tags: string[];
    onUpdate: (tags: string[]) => void;
  }

  let { tags, onUpdate }: Props = $props();

  let newTag = $state('');

  function addTag() {
    if (!newTag.trim()) return;
    const tag = newTag.trim().toLowerCase();
    if (!tags.includes(tag)) {
      onUpdate([...tags, tag]);
    }
    newTag = '';
  }

  function removeTag(tag: string) {
    onUpdate(tags.filter(t => t !== tag));
  }
</script>

<div class="mb-6">
  <h2 class="text-xs font-semibold text-ink-muted uppercase tracking-wider mb-2.5">{t('book.tags')}</h2>
  {#if tags.length}
    <div class="flex gap-1.5 flex-wrap mb-2">
      {#each tags as tag}
        <span class="text-xs px-2.5 py-0.5 bg-accent/10 text-accent rounded-full font-medium flex items-center gap-1">
          {tag}
          <button class="hover:text-berry transition-colors" onclick={() => removeTag(tag)}>&times;</button>
        </span>
      {/each}
    </div>
  {/if}
  <input
    type="text"
    bind:value={newTag}
    placeholder={t('book.tags_placeholder')}
    class="input-field !py-1.5 text-sm"
    onkeydown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
  />
</div>
