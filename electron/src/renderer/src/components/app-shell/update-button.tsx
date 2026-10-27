import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { getBridge } from '../bridge';
import type { UpdateState } from '../../../../preload/index.d';

/**
 * Always-visible updater control for the title bar.
 *
 * One decision at a time, driven by the supervisor's own state machine: offer
 * the download when a release exists, show byte progress while it runs, then
 * offer the restart that installs it. Nothing reinstalls the app, and every
 * string is an existing `update.*` key, so no locale catalog changes.
 */
export function UpdateButton() {
  const { t } = useTranslation();
  const [state, setState] = useState<UpdateState | null>(null);

  useEffect(() => {
    const updates = getBridge()?.updates;
    if (!updates) return;
    let alive = true;
    void updates
      .getState()
      .then((next) => {
        if (alive) setState(next);
      })
      .catch(() => {});
    const off = updates.onState((next) => setState(next));
    return () => {
      alive = false;
      off?.();
    };
  }, []);

  if (!state) return null;
  const updates = getBridge()?.updates;

  if (state.status === 'available' && state.availableVersion) {
    return (
      <Button
        size="xs"
        variant="outline"
        title={t('update.available', { version: state.availableVersion })}
        onClick={() => void updates?.download().catch(() => {})}
      >
        {t('update.download')}
      </Button>
    );
  }

  if (state.status === 'downloading') {
    return (
      <span className="font-mono text-[11px] tabular-nums text-muted-foreground">
        {t('update.downloading', { pct: Math.round(state.progress) })}
      </span>
    );
  }

  if (state.status === 'downloaded') {
    return (
      <Button
        size="xs"
        title={t('update.ready', { version: state.availableVersion ?? state.currentVersion })}
        onClick={() => void updates?.install().catch(() => {})}
      >
        {t('update.restart')}
      </Button>
    );
  }

  if (state.status === 'error') {
    return (
      <Button
        size="xs"
        variant="ghost"
        title={state.error ?? t('update.failed')}
        onClick={() => void updates?.check().catch(() => {})}
      >
        {t('update.retry')}
      </Button>
    );
  }

  return null;
}
