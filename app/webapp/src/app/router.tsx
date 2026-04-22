import { kvtFeatureRoute, kvtLayoutRoute, kvtRoute } from '@kvt/react'
import { AppLayout, FeatureFallback } from '../App'
import { HomePage } from '@features/home/presentation/view/HomePage'

/**
 * Routes are now declarative framework inputs.
 *
 * The framework turns this into React Router config and installs feature DI
 * modules during route loading.
 */
export const appRoutes = [
  kvtLayoutRoute({
    element: <AppLayout />,
    fallback: <FeatureFallback />,
    children: [
      kvtFeatureRoute({
        index: true,
        moduleKey: 'chat',
        module: () => import('@features/chat/di'),
        component: () => import('@features/chat/ui/ChatPage')
      })
    ]
  }),
  kvtRoute({
    path: '/home',
    element: <HomePage />
  })
]
