// Baseline browser-support linter.
//
// This ESLint config runs ONLY eslint-plugin-compat to flag uses of Web
// Platform APIs that are not supported across the browser set in the
// `browserslist` field of package.json (baseline-aligned targets).
//
// Astro handling: eslint-plugin-astro exposes a processor that extracts
// every inline <script> block in a .astro file into a virtual
// `*.astro/N_N.ts` sub-file. ESLint then lints each sub-file with the
// matching config block — so the compat rule applies to the JS that
// actually runs in browsers, not just the .astro shell. Without this,
// the inline room-page script (~1400 lines of WebRTC logic) would be
// invisible to the compat gate.

import compat from 'eslint-plugin-compat'
import astroPlugin from 'eslint-plugin-astro'
import astroParser from 'astro-eslint-parser'
import tsParser from '@typescript-eslint/parser'

const compatSettings = {
  lintAllEsApis: true,
  // Progressive-enhancement escape hatches: features that we detect at
  // runtime before using. eslint-plugin-compat can't see
  // `if (feature) { useFeature() }` guards, so list them here.
  polyfills: [
    'document.startViewTransition',
    'navigator.mediaDevices.getDisplayMedia',
    'CSSStyleSheet.prototype.replaceSync',
  ],
}

export default [
  {
    files: ['src/**/*.astro'],
    plugins: { astro: astroPlugin, compat },
    languageOptions: {
      parser: astroParser,
      parserOptions: {
        parser: tsParser,
        extraFileExtensions: ['.astro'],
        sourceType: 'module',
      },
    },
    processor: 'astro/client-side-ts',
    settings: compatSettings,
    rules: {
      'compat/compat': 'error',
    },
  },
  {
    files: ['**/*.astro/*.ts', '**/*.astro/*.js'],
    plugins: { compat },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        document: 'readonly',
        window: 'readonly',
        navigator: 'readonly',
        globalThis: 'readonly',
        location: 'readonly',
        localStorage: 'readonly',
        WebSocket: 'readonly',
        RTCPeerConnection: 'readonly',
        RTCRtpSender: 'readonly',
        MediaStream: 'readonly',
        MediaStreamTrack: 'readonly',
        AudioContext: 'readonly',
        ResizeObserver: 'readonly',
        ScriptProcessorNode: 'readonly',
        Int16Array: 'readonly',
        Uint8Array: 'readonly',
        ArrayBuffer: 'readonly',
        DataView: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        DOMException: 'readonly',
        URLSearchParams: 'readonly',
        URL: 'readonly',
        crypto: 'readonly',
        Blob: 'readonly',
        Event: 'readonly',
        TouchEvent: 'readonly',
        Touch: 'readonly',
        setInterval: 'readonly',
        setTimeout: 'readonly',
        clearInterval: 'readonly',
        clearTimeout: 'readonly',
        requestAnimationFrame: 'readonly',
        queueMicrotask: 'readonly',
      },
    },
    settings: compatSettings,
    rules: {
      'compat/compat': 'error',
    },
  },
]
