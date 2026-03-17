<script lang="ts">
  import { exportData, importData } from '$lib/services/backup';

  let importing = $state(false);
  let message = $state('');

  async function handleExport() {
    const json = await exportData();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `my-books-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    message = 'Export complete!';
  }

  async function handleImport(e: Event) {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    importing = true;
    try {
      const json = await file.text();
      await importData(json);
      message = 'Import complete! Refresh to see changes.';
    } catch {
      message = 'Import failed. Invalid file.';
    }
    importing = false;
  }
</script>

<div class="max-w-lg mx-auto">
  <h1 class="text-xl font-bold mb-6">Settings</h1>

  <div class="space-y-4">
    <div class="bg-slate-800 p-4 rounded-lg">
      <h2 class="font-medium mb-2">Export Library</h2>
      <p class="text-sm text-slate-400 mb-3">Download your entire library as a JSON file.</p>
      <button class="px-4 py-2 bg-blue-600 rounded-lg text-sm" onclick={handleExport}>Export</button>
    </div>

    <div class="bg-slate-800 p-4 rounded-lg">
      <h2 class="font-medium mb-2">Import Library</h2>
      <p class="text-sm text-slate-400 mb-3">Restore from a backup file. Existing data will be merged.</p>
      <input type="file" accept=".json" onchange={handleImport} disabled={importing}
        class="text-sm text-slate-400 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-slate-700 file:text-white" />
    </div>
  </div>

  {#if message}
    <p class="mt-4 text-sm text-green-400">{message}</p>
  {/if}
</div>
