// Separate config so generators never run with the normal test suite.
export default { test: { include: ['scripts/*.gen.ts'], environment: 'node' } }
