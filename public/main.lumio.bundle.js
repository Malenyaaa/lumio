/*
 * Intentionally empty. Jellyfin's official Android app (a WebView around the server's web client) only counts the
 * page as loaded once it asks for a file named main.<something>.bundle.js, as jellyfin-web's own bundle is called.
 * The app answers that request itself with its native shell (window.NativeShell) and then loads this file again with
 * ?deferred=true, which lands here. Browsers just load this comment.
 */
