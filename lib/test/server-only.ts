// Stand-in for the "server-only" package in tests. In the app, importing it from browser
// code fails the build, so secrets can't leak into the client. Tests run in Node, where
// there is no browser bundle to protect (vitest.config.mts points the import here).
export {};
