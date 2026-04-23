import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'KVT',
  description: 'KVT framework and webapp onboarding documentation',
  cleanUrls: true,
  locales: {
    root: {
      label: 'English',
      lang: 'en-US',
      title: 'KVT Docs',
      description: 'KVT framework and webapp onboarding documentation',
      themeConfig: {
        nav: [
          { text: 'KVT', link: '/kvt/guide/' },
          { text: 'Webapp', link: '/webapp/' },
          { text: 'Android Docs', link: 'https://developer.android.com/topic/architecture' }
        ],
        sidebar: {
          '/kvt/': createEnglishKvtSidebar(),
          '/webapp/': createEnglishWebappSidebar()
        },
        editLink: {
          pattern: ''
        }
      }
    },
    ru: {
      label: 'Русский',
      lang: 'ru-RU',
      title: 'KVT Docs',
      description: 'Документация KVT framework и webapp onboarding',
      themeConfig: {
        nav: [
          { text: 'KVT', link: '/ru/kvt/guide/' },
          { text: 'Webapp', link: '/ru/webapp/' },
          { text: 'Android Docs', link: 'https://developer.android.com/topic/architecture' }
        ],
        sidebar: {
          '/ru/kvt/': createRussianKvtSidebar(),
          '/ru/webapp/': createRussianWebappSidebar()
        },
        outline: {
          label: 'На этой странице'
        },
        docFooter: {
          prev: 'Предыдущая',
          next: 'Следующая'
        },
        darkModeSwitchLabel: 'Тема',
        sidebarMenuLabel: 'Меню',
        returnToTopLabel: 'Наверх',
        langMenuLabel: 'Изменить язык',
        search: {
          provider: 'local',
          options: {
            locales: {
              ru: {
                translations: {
                  button: {
                    buttonText: 'Поиск',
                    buttonAriaLabel: 'Поиск'
                  },
                  modal: {
                    noResultsText: 'Ничего не найдено',
                    resetButtonTitle: 'Сбросить поиск',
                    footer: {
                      selectText: 'выбрать',
                      navigateText: 'перейти',
                      closeText: 'закрыть'
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  },
  themeConfig: {
    logo: '/logo.svg',
    search: {
      provider: 'local'
    },
    socialLinks: [{ icon: 'github', link: 'https://github.com' }],
    footer: {
      message: 'Framework docs and project onboarding live side by side.',
      copyright: 'KVT documentation'
    }
  }
})

function createEnglishKvtSidebar() {
  return [
    {
      text: 'KVT Framework',
      items: [
        { text: 'Overview', link: '/kvt/guide/' },
        { text: 'Application Architecture', link: '/kvt/guide/architecture' },
        { text: 'Mental Model', link: '/kvt/guide/mental-model' }
      ]
    },
    {
      text: 'Core Concepts',
      items: [
        { text: 'Dependency Injection', link: '/kvt/guide/dependency-injection' },
        { text: 'ViewModel Lifecycle', link: '/kvt/guide/viewmodel-lifecycle' },
        { text: 'Flows and State', link: '/kvt/guide/flows' },
        { text: 'React Adapter', link: '/kvt/guide/react-adapter' },
        { text: 'Theming', link: '/kvt/guide/theming' }
      ]
    },
    {
      text: 'Reference',
      items: [
        { text: 'Disposable', link: '/kvt/reference/disposable' },
        { text: 'ViewModel', link: '/kvt/reference/viewmodel' },
        { text: 'Container', link: '/kvt/reference/container' },
        { text: 'Flow', link: '/kvt/reference/flow' }
      ]
    }
  ]
}

function createEnglishWebappSidebar() {
  return [
    {
      text: 'Onboarding',
      items: [
        { text: 'Start Here', link: '/webapp/' },
        { text: 'Architecture', link: '/webapp/architecture' },
        { text: 'Conventions', link: '/webapp/conventions' },
        { text: 'Local Development', link: '/webapp/local-development' }
      ]
    },
    {
      text: 'Backend and Deploy',
      items: [
        { text: 'Backend', link: '/webapp/backend' },
        { text: 'Production Deploy', link: '/webapp/production-deploy' },
        { text: 'Environment Variables', link: '/webapp/environment' }
      ]
    },
    {
      text: 'Product UI',
      items: [
        { text: 'Design System', link: '/webapp/design-system' },
        { text: 'Internationalization', link: '/webapp/i18n' },
        { text: 'Adaptive Layouts', link: '/webapp/adaptive-layouts' }
      ]
    }
  ]
}

function createRussianKvtSidebar() {
  return [
    {
      text: 'KVT framework',
      items: [
        { text: 'Обзор', link: '/ru/kvt/guide/' },
        { text: 'Архитектура приложения', link: '/ru/kvt/guide/architecture' },
        { text: 'Ментальная модель', link: '/ru/kvt/guide/mental-model' }
      ]
    },
    {
      text: 'Основные концепции',
      items: [
        { text: 'Dependency Injection', link: '/ru/kvt/guide/dependency-injection' },
        { text: 'Жизненный цикл ViewModel', link: '/ru/kvt/guide/viewmodel-lifecycle' },
        { text: 'Flows и состояние', link: '/ru/kvt/guide/flows' },
        { text: 'React adapter', link: '/ru/kvt/guide/react-adapter' },
        { text: 'Темы', link: '/ru/kvt/guide/theming' }
      ]
    },
    {
      text: 'Справочник',
      items: [
        { text: 'Disposable', link: '/ru/kvt/reference/disposable' },
        { text: 'ViewModel', link: '/ru/kvt/reference/viewmodel' },
        { text: 'Container', link: '/ru/kvt/reference/container' },
        { text: 'Flow', link: '/ru/kvt/reference/flow' }
      ]
    }
  ]
}

function createRussianWebappSidebar() {
  return [
    {
      text: 'Онбординг',
      items: [
        { text: 'С чего начать', link: '/ru/webapp/' },
        { text: 'Архитектура', link: '/ru/webapp/architecture' },
        { text: 'Конвенции', link: '/ru/webapp/conventions' },
        { text: 'Локальная разработка', link: '/ru/webapp/local-development' }
      ]
    },
    {
      text: 'Backend и Deploy',
      items: [
        { text: 'Backend', link: '/ru/webapp/backend' },
        { text: 'Production deploy', link: '/ru/webapp/production-deploy' },
        { text: 'Environment variables', link: '/ru/webapp/environment' }
      ]
    },
    {
      text: 'Product UI',
      items: [
        { text: 'Дизайн-система', link: '/ru/webapp/design-system' },
        { text: 'Интернационализация', link: '/ru/webapp/i18n' },
        { text: 'Адаптивные layouts', link: '/ru/webapp/adaptive-layouts' }
      ]
    }
  ]
}
