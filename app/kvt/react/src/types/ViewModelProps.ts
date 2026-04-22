import { ServiceIdentifier, ViewModel } from '@kvt/core'

export type PropsWithVM<TViewModel extends ViewModel, Props = unknown> = Props & {
  readonly _vm?: ServiceIdentifier<TViewModel>
}
