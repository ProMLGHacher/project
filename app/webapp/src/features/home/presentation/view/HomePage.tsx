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
  CardDescription,
  CardHeader,
  CardTitle,
  Field,
  FieldHint,
  Input,
  InputGroup
} from '@core/design-system'

export function HomePage({ _vm = HomeViewModel }: PropsWithVM<HomeViewModel>): ReactNode {
  const viewModel = useViewModel(_vm)
  const uiState = useStateFlow(viewModel.uiState)
  const navigate = useNavigate()
  const { t } = useTranslation('voice')
  const tx = t as unknown as (key: string, options?: Record<string, unknown>) => string

  useSharedFlow(viewModel.uiEffect, (effect) => {
    switch (effect.type) {
      case 'open-room':
        void navigate(`/rooms/${effect.roomId}`)
        break
      case 'show-message':
        console.info(tx(effect.message))
        break
    }
  })

  return (
    <section className="mx-auto grid min-h-full w-full max-w-6xl items-start px-4 pb-8 sm:px-6 sm:pb-10 lg:place-items-center">
      <div className="grid w-full gap-4 sm:gap-6 lg:grid-cols-5 lg:items-center">
        <Card className="overflow-hidden rounded-4xl border-primary/15 bg-surface lg:col-span-3">
          <CardContent className="grid gap-6 p-5 sm:p-8 md:gap-8 md:p-10">
            <div className="max-w-2xl">
              <Badge variant="info">{t('home.badge')}</Badge>
              <h1 className="mt-4 font-display text-3xl font-black tracking-tight text-surface-foreground sm:text-4xl md:mt-5 md:text-6xl">
                {t('home.title')}
              </h1>
              <p className="mt-4 max-w-xl text-sm leading-6 text-muted-foreground sm:text-base md:mt-5 md:text-lg md:leading-7">
                {t('home.description')}
              </p>
            </div>

            <div>
              <Button
                className="min-h-14 w-full rounded-2xl px-6 text-base shadow-lg shadow-primary/20 sm:min-h-16 sm:w-auto sm:px-8 sm:text-lg"
                disabled={!uiState.createRoomButtonState.enabled}
                onClick={() => viewModel.onEvent({ type: 'create-room-pressed' })}
                type="button"
              >
                {t('home.createRoom')}
              </Button>
              <p className="mt-3 text-sm text-muted-foreground">{t('home.createHint')}</p>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-4xl lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('home.joinTitle')}</CardTitle>
            <CardDescription>{t('home.joinDescription')}</CardDescription>
          </CardHeader>
          <CardContent>
            <Field>
              <InputGroup className="flex-col gap-2 sm:flex-row">
                <Input
                  aria-invalid={uiState.idOrLinkToJoinState.showError}
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
                  className="w-full sm:w-auto"
                  disabled={!uiState.joinButtonState.enabled}
                  onClick={() => viewModel.onEvent({ type: 'join-pressed' })}
                  type="button"
                  variant="secondary"
                >
                  {t('home.continue')}
                </Button>
              </InputGroup>
              {uiState.idOrLinkToJoinState.showError ? (
                <FieldHint className="text-destructive">
                  {uiState.idOrLinkToJoinState.error ? tx(uiState.idOrLinkToJoinState.error) : ''}
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
