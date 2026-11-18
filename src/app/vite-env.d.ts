/// <reference types="vite/client" />
/// <reference types="svelte" />
declare const __APP_VERSION__: string;

interface Window {
  /** The part of the address after "#" as it was when the page opened. Set by index.html. */
  __boubaLink?: string;
}
