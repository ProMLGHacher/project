import { KvtLink, KvtOutlet } from '@kvt/react'
import { useKvtTheme } from '@kvt/theme'
import { useTranslation } from 'react-i18next'
import {
  Badge,
  Button,
  Card,
  CardContent,
  NativeSelect,
  buttonClassName
} from '@core/design-system'
import { setLanguage, supportedLanguages, type SupportedLanguage } from '@core/i18n/config'

export function AppLayout() {
  const { t, i18n } = useTranslation('common')
  const { resolvedMode, toggleMode } = useKvtTheme()

  return (
    <main className="relative flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-linear-to-b from-hero-end/20 via-hero-start/25 to-transparent" />

      <nav className="sticky top-0 z-30 px-3 pt-3 sm:px-4 sm:pt-4 md:px-6">
        <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 rounded-3xl border border-border/70 bg-surface-overlay px-3 py-3 shadow-sm backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-2xl bg-primary text-sm font-black uppercase tracking-[0.2em] text-primary-foreground shadow-sm shadow-primary/30">
              K
            </div>
            <div className="min-w-0">
              <KvtLink
                className="block truncate font-display text-base font-black tracking-tight text-foreground"
                to="/"
              >
                {t('nav.brand')}
              </KvtLink>
              <p className="text-xs text-muted-foreground">{t('nav.tagline')}</p>
            </div>
          </div>

          <div className="grid w-full grid-cols-1 gap-2 text-sm sm:flex sm:w-auto sm:items-center sm:justify-end">
            <KvtLink
              className={buttonClassName({
                variant: 'ghost',
                size: 'sm',
                className: 'justify-center sm:justify-start'
              })}
              to="/"
            >
              {t('nav.main')}
            </KvtLink>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Badge className="hidden sm:inline-flex" variant="default">
                {resolvedMode === 'dark' ? t('nav.themeMode.dark') : t('nav.themeMode.light')}
              </Badge>
              <NativeSelect
                aria-label={t('nav.language')}
                className="w-full sm:w-[5.5rem]"
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
        </div>
      </nav>

      <div className="min-h-0 flex-1 px-0 pb-4 pt-4 sm:pb-6 md:pb-8">
        <KvtOutlet />
      </div>
    </main>
  )
}

export function FeatureFallback() {
  const { t } = useTranslation('common')

  return (
    <section className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
      <Card className="rounded-4xl">
        <CardContent className="p-8">
          <h2 className="text-2xl font-semibold text-surface-foreground">{t('loading.title')}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('loading.description')}</p>
        </CardContent>
      </Card>
    </section>
  )
}
