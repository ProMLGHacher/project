import type { ReactNode } from 'react'
import { useSharedFlow, useStateFlow, useViewModel, type PropsWithVM } from '@kvt/react'
import { useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { HomeViewModel } from '../view_model/HomeViewModel'
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
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
    <section className="mx-auto flex min-h-[calc(100vh-4.5rem)] w-full max-w-7xl items-center px-3 py-6 sm:px-4 md:px-6">
      <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,1.05fr)_minmax(24rem,0.95fr)] lg:gap-12">
        <div className="max-w-2xl">
          <p className="text-sm font-medium text-info">{t('home.badge')}</p>
          <h1 className="mt-4 text-4xl font-medium tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            {t('home.title')}
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-muted-foreground">
            {t('home.description')}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button
              className="min-h-12 rounded-full px-6 text-base"
              disabled={!uiState.createRoomButtonState.enabled}
              onClick={() => viewModel.onEvent({ type: 'create-room-pressed' })}
              type="button"
            >
              {t('home.createRoom')}
            </Button>
            <div className="flex items-center rounded-full border border-border bg-surface px-4 py-3 text-sm text-muted-foreground">
              {t('home.createHint')}
            </div>
          </div>
        </div>

        <Card className="rounded-4xl border-border bg-surface shadow-sm">
          <CardContent className="p-5 sm:p-6">
            <div className="grid gap-5">
              <div>
                <h2 className="text-2xl font-medium text-foreground">{t('home.joinTitle')}</h2>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {t('home.joinDescription')}
                </p>
              </div>

              {uiState.feedback && (
                <Alert variant="warning">
                  <AlertDescription>{t(uiState.feedback)}</AlertDescription>
                </Alert>
              )}

              <Field className="gap-3">
                <InputGroup className="flex-col gap-3 sm:flex-row">
                  <Input
                    aria-invalid={uiState.idOrLinkToJoinState.showError}
                    className="min-h-12 flex-1 rounded-full px-5"
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
                    className="min-h-12 rounded-full px-6"
                    disabled={!uiState.joinButtonState.enabled || uiState.joinButtonState.loading}
                    onClick={() => viewModel.onEvent({ type: 'join-pressed' })}
                    type="button"
                    variant="outline"
                  >
                    {uiState.joinButtonState.loading ? t('home.checking') : t('home.continue')}
                  </Button>
                </InputGroup>

                {uiState.idOrLinkToJoinState.showError ? (
                  <FieldHint className="text-destructive">
                    {uiState.idOrLinkToJoinState.error ? t(uiState.idOrLinkToJoinState.error) : ''}
                  </FieldHint>
                ) : (
                  <FieldHint>{t('home.directJoinHint')}</FieldHint>
                )}
              </Field>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  )
}
