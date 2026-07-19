const process = require('node:process')

const logLevel = process.env.WDIO_LOG_LEVEL || 'error'

exports.config = {
  runner: 'local',
  specs: [
    './e2e/specs/**/*.e2e.js',
  ],
  maxInstances: 1,
  maxInstancesPerCapability: 1,
  logLevel,
  logLevels: {
    '@wdio/cli': logLevel,
    '@wdio/local-runner': logLevel,
    '@wdio/tauri-service': logLevel,
    '@wdio/utils': logLevel,
    'webdriver': logLevel,
  },
  framework: 'mocha',
  reporters: ['spec'],
  mochaOpts: {
    timeout: 60000,
  },
  capabilities: [{
    'browserName': 'tauri',
    'maxInstances': 1,
    'tauri:options': {
      application: './src-tauri/target/debug/Flippio',
    },
  }],
  services: [[
    '@wdio/tauri-service',
    {
      appBinaryPath: './src-tauri/target/debug/Flippio',
      driverProvider: 'embedded',
      logLevel,
    },
  ]],
}
