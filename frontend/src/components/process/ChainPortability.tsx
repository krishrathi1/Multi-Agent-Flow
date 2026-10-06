import { useRef, useState } from 'react';
import { Download, FileJson, Package, Upload } from 'lucide-react';
import { api } from '../../lib/api';
import type { Process } from '../../types';
import { Card, CardHeader } from '../ui/Card';
import { Button } from '../ui/Button';
import { CustomSelect } from '../ui/CustomSelect';
import { useToast } from '../ui/Toast';

/** Bundles can be pasted or dropped; anything larger is not a chain. */
const MAX_BUNDLE_BYTES = 2 * 1024 * 1024;

/**
 * Moving a chain in and out of this installation.
 *
 * A tuned roster used to be trapped in the database that produced it — there
 * was no way to promote a chain from a scratch org to a real one, hand it to
 * a teammate, or keep it under version control.
 */
export function ChainPortability({
  processes,
  onImported,
}: {
  processes: Process[];
  onImported?: () => void;
}) {
  const toast = useToast();
  const [selected, setSelected] = useState('');
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const chainId = selected || processes[0]?.id || '';

  const handleExport = async () => {
    if (!chainId) return;
    setBusy(true);
    try {
      const bundle = await api.orchestration.exportChain(chainId);
      // Saved client-side rather than linked: the API authorises with a Bearer
      // header, which a plain download link cannot send.
      const blob = new Blob([JSON.stringify(bundle, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${bundle.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'chain'}.nexus-chain.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoking immediately can cancel the download in some browsers.
      setTimeout(() => URL.revokeObjectURL(url), 10_000);

      toast.success('Chain exported', `${bundle.agents.length} agents written to a bundle.`);
    } catch (err) {
      toast.error('Could not export', (err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    if (file.size > MAX_BUNDLE_BYTES) {
      toast.error('That file is too large', 'A chain bundle is a few kilobytes of JSON.');
      return;
    }

    setBusy(true);
    try {
      const text = await file.text();
      let parsed: unknown;
      try {
        parsed = JSON.parse(text);
      } catch {
        // Distinguish "not JSON" from "JSON but not a chain" — the fixes differ.
        toast.error('That file is not JSON', 'Pick a .nexus-chain.json bundle.');
        return;
      }

      const result = await api.orchestration.importChain(parsed);
      toast.success('Chain imported', `"${result.name}" is ready to run.`);
      onImported?.();
    } catch (err) {
      toast.error('Could not import', (err as Error).message);
    } finally {
      setBusy(false);
      // Allow re-picking the same file after a failure.
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  return (
    <Card padding="none">
      <CardHeader
        bordered
        icon={Package}
        title="Import & export"
        description="Move a proven chain between environments, or keep it in version control."
      />
      <div className="grid gap-4 p-4 md:grid-cols-2">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            <Download size={12} strokeWidth={2} aria-hidden />
            Export a chain
          </p>
          {processes.length === 0 ? (
            <p className="text-sm text-ink-subtle">No chains to export yet.</p>
          ) : (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[14rem] flex-1">
                <label className="block text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint mb-1.5">
                  Chain
                </label>
                <CustomSelect
                  value={chainId}
                  onChange={(val) => setSelected(val)}
                  options={processes.map((p) => ({
                    value: p.id,
                    label: p.name,
                  }))}
                  size="md"
                />
              </div>
              <Button
                variant="secondary"
                icon={Download}
                loading={busy}
                onClick={handleExport}
                className="h-9"
              >
                Download
              </Button>
            </div>
          )}
          <p className="mt-2 text-xs text-ink-faint">
            The roster, prompt and guardrails — never run history or share tokens.
          </p>
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-2xs font-semibold uppercase tracking-[0.09em] text-ink-faint">
            <Upload size={12} strokeWidth={2} aria-hidden />
            Import a bundle
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void handleImport(f);
            }}
          />
          <Button
            variant="secondary"
            icon={FileJson}
            loading={busy}
            onClick={() => fileRef.current?.click()}
          >
            Choose a bundle…
          </Button>
          <p className="mt-2 text-xs text-ink-faint">
            Creates a new chain — an existing one with the same name is never
            overwritten.
          </p>
        </div>
      </div>
    </Card>
  );
}
