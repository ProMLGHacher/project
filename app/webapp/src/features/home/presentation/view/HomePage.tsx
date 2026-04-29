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
        void navigate(`/rooms/${effect.roomId}`, { viewTransition: true })
        break
      case 'show-message':
        toasts.error(t(effect.message))
        break
    }
  })

  return (
    <section className="mx-auto grid min-h-screen w-full max-w-5xl place-items-center px-4 py-10">
      <div className="w-full">
        <h1 className="text-center text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
          {t('home.title')}
        </h1>

        <div className="mt-10 grid gap-4 md:grid-cols-[minmax(0,1.35fr)_minmax(20rem,0.9fr)]">
          <button
            className="group grid min-h-[22rem] place-items-center rounded-[2rem] border border-border/70 bg-surface text-center shadow-xl shadow-black/8 transition hover:-translate-y-0.5 hover:bg-surface-elevated hover:shadow-2xl disabled:pointer-events-none disabled:opacity-50 md:min-h-[26rem]"
            disabled={!uiState.createRoomButtonState.enabled}
            onClick={() => viewModel.onEvent({ type: 'create-room-pressed' })}
            type="button"
          >
            <div>
              <div className="mx-auto grid size-24 place-items-center rounded-[2rem] bg-background text-foreground transition group-hover:scale-105">
                <LogoMark />
              </div>
              <p className="mt-6 text-xl font-semibold text-foreground">{t('home.createRoom')}</p>
            </div>
          </button>

          <Card className="rounded-[2rem] border-border/70 bg-surface shadow-xl shadow-black/8">
            <CardContent className="grid h-full content-center gap-5 p-5 sm:p-6">
              <div className="text-center">
                <div className="mx-auto grid size-20 place-items-center rounded-[1.5rem] bg-background text-foreground">
                  <JoinIcon />
                </div>
                <h2 className="mt-5 text-xl font-semibold text-foreground">
                  {t('home.joinTitle')}
                </h2>
              </div>

              {uiState.feedback && (
                <Alert variant="warning">
                  <AlertDescription>{t(uiState.feedback)}</AlertDescription>
                </Alert>
              )}

              <Field className="gap-3">
                <Input
                  aria-invalid={uiState.idOrLinkToJoinState.showError}
                  className="min-h-12 rounded-2xl bg-background px-5 text-center"
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
                  className="min-h-12 rounded-2xl px-6"
                  disabled={!uiState.joinButtonState.enabled || uiState.joinButtonState.loading}
                  onClick={() => viewModel.onEvent({ type: 'join-pressed' })}
                  type="button"
                >
                  {uiState.joinButtonState.loading ? t('home.checking') : t('home.continue')}
                </Button>

                {uiState.idOrLinkToJoinState.showError ? (
                  <FieldHint className="text-destructive">
                    {uiState.idOrLinkToJoinState.error ? t(uiState.idOrLinkToJoinState.error) : ''}
                  </FieldHint>
                ) : (
                  <FieldHint className="text-center">{t('home.directJoinHint')}</FieldHint>
                )}
              </Field>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  )
}

function LogoMark() {
  return (
    <svg aria-hidden="true" className="size-14" fill="none" viewBox="0 0 64 64">
      <path
        d="M32 12a20 20 0 1 1 0 40 20 20 0 0 1-9.2-2.2L15 53l2.3-8A19.8 19.8 0 0 1 12 32a20 20 0 0 1 20-20Z"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="3"
      />
      <path d="M18.7 46.2 15 53l7.2-2.8c-1.4-.2-2.6-.9-3.5-2.1Z" fill="currentColor" />
      <circle cx="39.6" cy="24.7" r="3.6" fill="var(--color-primary)" />
      <path
        d="M39.4 37.9c1.1 1.2 2.2 1.9 3.4 1.9.9 0 1.9-.3 2.7-.8"
        stroke="var(--color-primary)"
        strokeLinecap="round"
        strokeWidth="2"
      />
    </svg>
  )
}

function JoinIcon() {
  return (
    <svg aria-hidden="true" className="size-12" fill="none" viewBox="0 0 64 64">
      <circle cx="24" cy="24" r="8" stroke="currentColor" strokeWidth="3" />
      <circle cx="43" cy="25" r="7" stroke="currentColor" strokeWidth="3" />
      <path
        d="M10 49c2.6-8 9.4-12 14-12s11.4 4 14 12M34 40c3-2.3 6-3 9-3 4 0 9 3.4 11 10"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="3"
      />
    </svg>
  )
}
