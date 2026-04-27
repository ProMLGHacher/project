import { useState } from 'react'
import { KvtOutlet } from '@kvt/react'
import { useTranslation } from 'react-i18next'
import { useLocation } from 'react-router'
import { Button, Card, CardContent } from '@core/design-system'
import { SettingsIcon, SettingsModal } from '@features/settings/presentation/view/SettingsModal'

export function AppLayout() {
  const { t } = useTranslation('common')
  const location = useLocation()
  const [settingsOpen, setSettingsOpen] = useState(false)
  const roomChromeOwnsSettings = location.pathname.startsWith('/rooms/')

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="min-h-0">
        <KvtOutlet />
      </div>

      {!roomChromeOwnsSettings && (
        <Button
          aria-label={t('settings.title')}
          className="fixed bottom-4 right-4 z-30 size-12 rounded-full p-0 shadow-xl shadow-black/10"
          onClick={() => setSettingsOpen(true)}
          size="icon"
          type="button"
          variant="outline"
        >
          <SettingsIcon />
        </Button>
      )}

      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </main>
  )
}

export function FeatureFallback() {
  const { t } = useTranslation('common')

  return (
    <section className="mx-auto w-full max-w-7xl px-3 py-6 sm:px-4 md:px-6">
      <Card className="rounded-4xl">
        <CardContent className="p-8">
          <h2 className="text-2xl font-semibold text-surface-foreground">{t('loading.title')}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('loading.description')}</p>
        </CardContent>
      </Card>
    </section>
  )
}
