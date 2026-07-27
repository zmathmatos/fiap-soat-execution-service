'use strict';

const enabled = process.env.NEW_RELIC_ENABLED === 'true';

exports.config = {
  agent_enabled: enabled,
  app_name: [process.env.NEW_RELIC_APP_NAME || 'fiap-execution-dev'],
  license_key: process.env.NEW_RELIC_LICENSE_KEY || '',
  logging: {
    level: process.env.NEW_RELIC_LOG_LEVEL || 'info',
    filepath: 'stdout',
  },
  allow_all_headers: true,
  attributes: {
    exclude: [
      'request.headers.cookie',
      'request.headers.authorization',
      'request.headers.proxyAuthorization',
      'request.headers.setCookie*',
      'request.headers.x*',
      'response.headers.cookie',
      'response.headers.authorization',
      'response.headers.proxyAuthorization',
      'response.headers.setCookie*',
      'response.headers.x*',
    ],
  },
  distributed_tracing: { enabled: true },
  application_logging: {
    forwarding: { enabled: true },
    metrics: { enabled: true },
    local_decorating: { enabled: true },
  },
  transaction_tracer: { enabled: true },
};
