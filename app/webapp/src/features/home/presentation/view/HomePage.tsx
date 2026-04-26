import type { ReactNode } from 'react'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { HomeViewModel } from '../view_model/HomeViewModel'
import {
  Badge,
  Button,
  Card,
  CardContent,
  Alert,
  AlertDescription,
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldHint,
  Input,
  InputGroup,
  useToast
} from '@core/design-system'

export function HomePage({ _vm = HomeViewModel }: PropsWithVM<HomeViewModel>): ReactNode {
  const viewModel = useViewModel(_vm)
  const uiState = useStateFlow(viewModel.uiState)
  const navigate = useNavigate()
  const { t } = useTranslation('voice')
  const toasts = useToast()

  useSharedFlow(viewModel.uiEffect, (effect) => {
    switch (effect.type) {
      case 'open-room':
        void navigate(`/rooms/${effect.roomId}`)
        break
      case 'show-message':
        toasts.error(t(effect.message))
        break
    }
  })

  return (
    <section className="mx-auto grid min-h-full w-full max-w-7xl items-start px-3 sm:px-4 md:px-6">
      <div className="grid w-full gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(22rem,0.8fr)] lg:items-stretch">
        <Card className="relative overflow-hidden rounded-[calc(var(--radius-2xl)+0.5rem)] border-primary/10 bg-linear-to-br from-surface via-surface to-accent/35">
          <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-2/5 bg-radial from-primary/18 via-primary/7 to-transparent blur-2xl lg:block" />
          <CardContent className="relative grid gap-8 p-5 sm:p-8 lg:grid-cols-[minmax(0,1fr)_18rem] lg:gap-6 lg:p-10">
            <div className="max-w-2xl">
              <Badge variant="info">{t('home.badge')}</Badge>
              <h1 className="mt-4 font-display text-4xl font-black tracking-tight text-surface-foreground sm:text-5xl lg:text-6xl">
                {t('home.title')}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
                {t('home.description')}
              </p>

              <div className="mt-6 grid gap-3 sm:flex sm:flex-wrap">
                <Button
                  className="min-h-16 w-full rounded-3xl px-7 text-base shadow-lg shadow-primary/20 sm:w-auto sm:text-lg"
                  disabled={!uiState.createRoomButtonState.enabled}
                  onClick={() => viewModel.onEvent({ type: 'create-room-pressed' })}
                  type="button"
                >
                  {t('home.createRoom')}
                </Button>
                <div className="rounded-3xl border border-border/70 bg-surface-overlay px-4 py-3 text-sm text-muted-foreground backdrop-blur-sm sm:max-w-64">
                  {t('home.createHint')}
                </div>
              </div>
            </div>

            <div className="grid gap-3 self-end">
              <HeroMetric
                label={t('home.metrics.audioLabel')}
                value={t('home.metrics.audioValue')}
              />
              <HeroMetric
                label={t('home.metrics.videoLabel')}
                value={t('home.metrics.videoValue')}
              />
              <HeroMetric label={t('home.metrics.flowLabel')} value={t('home.metrics.flowValue')} />
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-[calc(var(--radius-2xl)+0.5rem)]">
          <CardHeader className="border-b-0 pb-0">
            <CardTitle className="text-2xl">{t('home.joinTitle')}</CardTitle>
            <CardDescription>{t('home.joinDescription')}</CardDescription>
          </CardHeader>
          <CardContent className="pt-5">
            <Field className="gap-4">
              {uiState.feedback && (
                <Alert variant="warning">
                  <AlertDescription>{t(uiState.feedback)}</AlertDescription>
                </Alert>
              )}

              <div className="rounded-3xl border border-border/70 bg-muted/35 p-3">
                <InputGroup className="flex-col gap-3">
                  <Input
                    aria-invalid={uiState.idOrLinkToJoinState.showError}
                    className="min-h-13"
                    placeholder={t('home.roomInputPlaceholder')}
                    type="text"
                    value={uiState.idOrLinkToJoinState.value}
                    onChange={(event) =>
                      viewModel.onEvent({
                        type: 'id-or-link-to-join-changed',
                        value: event.target.value
                      })
                    }
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        viewModel.onEvent({ type: 'join-pressed' })
                      }
                    }}
                  />
                  <Button
                    className="w-full"
                    disabled={!uiState.joinButtonState.enabled || uiState.joinButtonState.loading}
                    onClick={() => viewModel.onEvent({ type: 'join-pressed' })}
                    size="lg"
                    type="button"
                    variant="secondary"
                  >
                    {uiState.joinButtonState.loading ? t('home.checking') : t('home.continue')}
                  </Button>
                </InputGroup>
              </div>

              {uiState.idOrLinkToJoinState.showError ? (
                <FieldHint className="text-destructive">
                  {uiState.idOrLinkToJoinState.error ? t(uiState.idOrLinkToJoinState.error) : ''}
                </FieldHint>
              ) : (
                <FieldHint>{t('home.directJoinHint')}</FieldHint>
              )}
            </Field>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}

function HeroMetric({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="rounded-3xl border border-border/70 bg-surface-overlay p-4 backdrop-blur-sm">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </p>
      <p className="mt-2 font-display text-lg font-black tracking-tight text-surface-foreground">
        {value}
      </p>
    </div>
  )
}
