import { KvtLink, KvtOutlet } from '@kvt/react'
import { useKvtTheme } from '@kvt/theme'
import { useTranslation } from 'react-i18next'
import { Button, Card, CardContent, NativeSelect, buttonClassName } from '@core/design-system'
import { setLanguage, supportedLanguages, type SupportedLanguage } from '@core/i18n/config'

export function AppLayout() {
  const { t, i18n } = useTranslation('common')
  const { resolvedMode, toggleMode } = useKvtTheme()
  const tx = t as unknown as (key: string) => string

  return (
    <main className="flex min-h-screen flex-col overflow-x-hidden bg-background text-foreground">
      <nav className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-6">
        <KvtLink
          className="self-start text-left text-sm font-semibold uppercase tracking-widest text-primary sm:self-auto"
          to="/"
        >
          {t('nav.brand')}
        </KvtLink>
        <div className="grid w-full grid-cols-2 gap-2 text-sm sm:flex sm:w-auto sm:items-center sm:justify-end sm:gap-3">
          <KvtLink
            className={buttonClassName({
              variant: 'outline',
              size: 'sm',
              className: 'justify-center rounded-full bg-surface'
            })}
            to="/"
          >
            {t('nav.main')}
          </KvtLink>
          <NativeSelect
            aria-label={t('nav.language')}
            className="w-full rounded-full px-4 sm:w-auto"
            value={i18n.language}
            onChange={(event) => void setLanguage(event.target.value as SupportedLanguage)}
          >
            {supportedLanguages.map((language) => (
              <option key={language} value={language}>
                {language.toUpperCase()}
              </option>
            ))}
          </NativeSelect>
          <Button
            className="col-span-2 rounded-full bg-surface sm:col-span-1"
            onClick={toggleMode}
            size="sm"
            type="button"
            variant="outline"
          >
            {t('nav.theme')}: {tx(`nav.themeMode.${resolvedMode}`)}
          </Button>
        </div>
      </nav>

      <div className="min-h-0 flex-1">
        <KvtOutlet />
      </div>
    </main>
  )
}

export function FeatureFallback() {
  const { t } = useTranslation('common')

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-10">
      <Card className="rounded-4xl">
        <CardContent className="p-8">
          <h2 className="text-2xl font-semibold text-surface-foreground">{t('loading.title')}</h2>
          <p className="mt-3 text-sm text-muted-foreground">{t('loading.description')}</p>
        </CardContent>
      </Card>
    </section>
  )
}
