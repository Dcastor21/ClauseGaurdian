import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

const config: NextConfig = {
  serverExternalPackages: [
    '@opentelemetry/instrumentation',
    '@sentry/opentelemetry',
  ],
}

export default withSentryConfig(config, {
  silent: true,
  disableLogger: true,
  automaticVercelMonitors: false,
})
