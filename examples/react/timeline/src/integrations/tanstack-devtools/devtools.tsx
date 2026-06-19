import { TanStackDevtools } from '@tanstack/react-devtools'
import { timeDevtoolsPlugin } from '@tanstack/react-time-devtools'
import { ReactQueryDevtoolsPanel } from '@tanstack/react-query-devtools'

export function Devtools() {
  return (
    <TanStackDevtools
      plugins={[
        timeDevtoolsPlugin(),
        {
          name: 'TanStack Query',
          render: <ReactQueryDevtoolsPanel />,
        },
      ]}
    />
  )
}
