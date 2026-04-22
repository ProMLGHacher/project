import { MutableStateFlow, ViewModel } from '@kvt/core'
import { initialHomeState, type HomeUiAction, type HomeUiState } from '../model/HomeState'

export class HomeViewModel extends ViewModel {
  private readonly state = new MutableStateFlow<HomeUiState>(initialHomeState)
  readonly uiState = this.state.asStateFlow()

  onEvent(event: HomeUiAction) {
    switch (event.type) {
      case 'join-pressed':
        console.log('join')
        break
      case 'create-room-pressed':
        console.log('createRoom')
        break
      case 'id-or-link-to-join-changed':
        this.state.update((state) => ({
          ...state,
          idOrLinkToJoinState: { ...state.idOrLinkToJoinState, value: event.value }
        }))
        break
      default:
        throw new Error(`Unknown event: ${JSON.stringify(event)}`)
    }
  }
}
