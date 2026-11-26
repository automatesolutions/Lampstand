// Runs in <head> before React. Chrome and Edge can send `beforeinstallprompt` that early,
// so this keeps the event on window for lib/install.ts.
export const installBootScript = `window.addEventListener("beforeinstallprompt",function(e){e.preventDefault();window.__installPrompt=e;});`;
