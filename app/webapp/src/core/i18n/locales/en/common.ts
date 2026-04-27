import type ruCommon from '../ru/common'
import { defineResource } from '../../translation-key'

export default defineResource<typeof ruCommon>()({
  nav: {
    brand: 'KVT rooms',
    tagline: 'Voice-first rooms with fast joins',
    main: 'Home',
    theme: 'Theme',
    language: 'Language',
    themeMode: {
      light: 'light',
      dark: 'dark'
    }
  },
  settings: {
    eyebrow: 'App',
    title: 'Settings',
    close: 'Close settings',
    tabs: {
      profile: 'Profile',
      media: 'Media',
      appearance: 'Interface'
    },
    profile: {
      title: 'Profile',
      description: 'Your name is saved locally and prefilled before you join a room.',
      name: 'Nickname',
      hint: 'You can still change it before every meeting.'
    },
    media: {
      title: 'Media',
      description: 'Check your camera and microphone, choose devices, and save join defaults.',
      microphone: 'Microphone',
      camera: 'Camera',
      micHint: 'Join with microphone enabled by default.',
      cameraHint: 'Join with camera enabled by default.',
      defaultDevice: 'Default',
      previewOff: 'Camera is off or preview is unavailable.'
    },
    appearance: {
      title: 'Interface',
      description: 'Language and theme now live here without a separate site header.',
      language: 'Language',
      theme: 'Theme',
      light: 'Light theme',
      dark: 'Dark theme'
    },
    errors: {
      permissionDenied: 'The browser blocked camera or microphone access.',
      deviceNotFound: 'The selected device was not found.',
      deviceBusy: 'Camera or microphone is already used by another app.',
      insecureContext: 'Camera and microphone require a secure context.',
      apiUnavailable: 'This browser does not support camera and microphone access.',
      preview: 'Could not start preview.'
    }
  },
  loading: {
    title: 'Loading room...',
    description: 'Preparing the screen and app state.'
  }
} as const)
