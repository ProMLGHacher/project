import type ruVoice from '../ru/voice'
import { defineResource } from '../../translation-key'

export default defineResource<typeof ruVoice>()({
  home: {
    badge: 'KVT rooms',
    title: 'KVT rooms — chats and video calls',
    description:
      'Create a room, send the link, and join with a clear prejoin flow, soft event feedback, and attention on people.',
    createRoom: 'Create video meeting',
    createHint: 'Before entering, you can calmly check your name, camera, and microphone.',
    metrics: {
      audioLabel: 'Sound',
      audioValue: 'Events are easy to notice',
      videoLabel: 'Video',
      videoValue: 'Tiles adapt automatically',
      flowLabel: 'Flow',
      flowValue: 'Links open the room'
    },
    joinTitle: 'Connect',
    joinDescription: 'Paste a room id or invitation link.',
    roomInputPlaceholder: 'clear-river-42',
    continue: 'Continue',
    checking: 'Checking...',
    directJoinHint: 'If the room exists, we will open the join screen right away.',
    errors: {
      roomInputRequired: 'Enter a room id or link',
      invalidRoom: 'Enter a valid room id or link',
      roomNotFound: 'This room does not exist. Check the id or ask for a new link.',
      checkRoom: 'Could not check the room. Check your connection and try again.',
      createRoom: 'Could not create room.'
    }
  },
  prejoin: {
    badge: 'Prejoin',
    cameraPreview: 'Camera preview',
    cameraOff: 'Camera is off.',
    title: 'Ready to join?',
    description: 'Set your name and choose how you want to enter the room.',
    nameLabel: 'Your name',
    namePlaceholder: 'Araik',
    microphone: 'Microphone',
    camera: 'Camera',
    micOn: 'You will join unmuted.',
    micOff: 'You will join muted.',
    cameraOn: 'Your camera preview is on.',
    cameraOffShort: 'Camera will stay off.',
    defaultDevice: 'Default',
    joinRoom: 'Join room',
    joining: 'Joining...',
    errors: {
      load: 'Could not load room settings.',
      roomNotFound:
        'This room is no longer available. It may have ended or the server may have restarted.',
      mediaUnavailable:
        'Could not read your devices. Check camera and microphone permissions in the browser.',
      permissionDenied:
        'The browser blocked access to the selected devices. Allow access in site settings or turn mic and camera off before joining.',
      deviceNotFound: 'The selected device was not found. Connect it or choose another device.',
      deviceBusy:
        'Camera or microphone is already used by another app. Close it or choose another device.',
      insecureContext: 'Camera and microphone require a secure page. Open the site over HTTPS.',
      apiUnavailable: 'This browser does not support camera and microphone access for calls.',
      nameRequired: 'Name is required',
      enterName: 'Enter your name before joining.',
      join: 'Could not join room.',
      preview: 'Could not start local preview.'
    }
  },
  room: {
    header: {
      title: 'Room {{roomId}}',
      untitled: 'Room',
      participants: '{{count}} participants',
      participants_one: '{{count}} participant',
      participants_few: '{{count}} participants',
      participants_many: '{{count}} participants',
      participants_other: '{{count}} participants',
      techInfo: 'Tech info',
      voiceMode: 'Voice first',
      copyLink: 'Copy link',
      leave: 'Leave'
    },
    panels: {
      participants: 'Participants',
      roomInfo: 'Room info',
      techInfo: 'Tech info',
      settings: 'Settings',
      close: 'Close'
    },
    info: {
      roomId: 'Room ID',
      status: 'Status',
      participants: 'Participants'
    },
    empty: {
      title: 'Room is waiting.',
      description: 'Join settings will open before media starts.'
    },
    participant: {
      you: 'You',
      screen: 'Screen',
      screenFrom: "{{name}}'s screen",
      mic: 'Mic',
      cam: 'Cam',
      pin: 'Pin',
      unpin: 'Unpin',
      pinned: 'Pinned',
      fullscreen: 'Fullscreen',
      waitingMedia: 'Participant is connected, waiting for media.',
      roles: {
        host: 'Host',
        participant: 'Participant'
      }
    },
    controls: {
      mute: 'Mute',
      unmute: 'Unmute',
      cameraOff: 'Camera off',
      cameraOn: 'Camera on',
      stopShare: 'Stop share',
      shareScreen: 'Share screen',
      collapsePanel: 'Collapse panel',
      expandPanel: 'Expand panel'
    },
    tech: {
      title: 'Technical info',
      room: 'Room',
      publisher: 'Publisher',
      subscriber: 'Subscriber',
      signaling: 'Signaling',
      noDiagnostics: 'No diagnostics yet.',
      export: 'Export',
      clear: 'Clear'
    },
    status: {
      checkingRoom: 'Checking room.',
      chooseSettings: 'Choose how you want to enter the room.',
      logsCleared: 'Local logs cleared.',
      microphoneOn: 'Microphone is on.',
      microphoneMuted: 'Microphone is muted.',
      cameraOn: 'Camera is on.',
      cameraOff: 'Camera is off.',
      screenStarted: 'Screen sharing started.',
      screenStopped: 'Screen sharing stopped.',
      linkCopied: 'Room link copied.',
      linkCopyFailed: 'Could not copy room link.',
      mediaStarting: 'Room media is starting.',
      roomUnavailable: 'Room is no longer available.',
      roomCheckFailed: 'Could not check the room.',
      sessionExpired: 'Session expired. Join the room again.'
    },
    toasts: {
      logsConsole: 'Logs are ready in console for this presentation pass.',
      logsPrepared: 'Logs prepared.',
      logsCleared: 'Local logs cleared.',
      sessionMissing: 'Join session was not found.',
      microphoneFailed: 'Could not update microphone.',
      cameraFailed: 'Could not update camera.',
      screenFailed: 'Could not update screen sharing.',
      linkCopied: 'Room link copied.',
      linkCopyFailed: 'Could not copy room link.',
      mediaFailed: 'Could not start room media.',
      sessionExpired: 'Session expired. Check your settings and join again.'
    },
    errors: {
      roomUnavailable: {
        title: 'Room is no longer available',
        description:
          'This room may have ended after a server restart or is no longer stored. We cleared local data for this room so the next join does not get stuck.',
        action: 'Back to home'
      },
      roomCheckFailed: {
        title: 'Could not check the room',
        description:
          'The app could not reach the room server right now. Check your connection and try opening the link again.',
        action: 'Back to home'
      }
    }
  }
} as const)
