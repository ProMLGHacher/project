import common from './locales/ru/common'
import chat from './locales/ru/chat'

/**
 * Default-locale resources used by i18next's official TypeScript integration.
 *
 * The app still lazy-loads runtime namespaces from locales/* in config.ts.
 * This object is the compile-time shape that powers useTranslation autocomplete.
 */
const resources = {
  chat,
  common
} as const

export default resources
