import { KvtLink, KvtOutlet } from '@kvt/react'
import { useKvtTheme } from '@kvt/theme'
import { useTranslation } from 'react-i18next'
import { Badge, Button, Card, CardContent, NativeSelect } from '@core/design-system'
import { setLanguage, supportedLanguages, type SupportedLanguage } from '@core/i18n/config'

export function AppLayout() {
  const { t, i18n } = useTranslation('common')
  const { resolvedMode, toggleMode } = useKvtTheme()

  return (
    <main className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/80 bg-surface">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3 px-3 py-3 sm:px-4 md:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-10 shrink-0 place-items-center rounded-full bg-info text-sm font-black text-on-feedback">
              K
            </div>
            <div className="min-w-0">
              <KvtLink className="block truncate text-base font-semibold text-foreground" to="/">
                {t('nav.brand')}
              </KvtLink>
              <p className="truncate text-xs text-muted-foreground">{t('nav.tagline')}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge className="hidden md:inline-flex" variant="default">
              {resolvedMode === 'dark' ? t('nav.themeMode.dark') : t('nav.themeMode.light')}
            </Badge>
            <NativeSelect
              aria-label={t('nav.language')}
              className="w-20"
              value={i18n.language}
              onChange={(event) => void setLanguage(event.target.value as SupportedLanguage)}
            >
              {supportedLanguages.map((language) => (
                <option key={language} value={language}>
                  {language.toUpperCase()}
                </option>
              ))}
            </NativeSelect>
            <Button onClick={toggleMode} size="sm" type="button" variant="outline">
              {t('nav.theme')}
            </Button>
          </div>
        </div>
      </header>

      <div className="min-h-0">
        <KvtOutlet />
      </div>
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
