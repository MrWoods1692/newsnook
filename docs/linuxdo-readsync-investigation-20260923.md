# LinuxDO read-sync investigation: readsync-20260923-r2

## Scope and provenance

Base commit: `4a8fe9d` on `beta`. Work performed in the existing isolated `newsnook-build-readsync` worktree. Unrelated TTS, video, and search modifications in the main workspace are excluded.

The previously supplied signed cloud APK contained the `session-chain` change from `4a8fe9d`. Its failure was not explained by accidentally sending the earlier browserOnly build.

## Confirmed client-side defects

1. `postFormVoid` retried any 403 as a stale CSRF token, including a Cloudflare challenge during the CSRF GET before the timings POST existed. The error lacked the actual request phase and path.
2. Concurrent CSRF requests were not consolidated. Native response handling returned the token without waiting for asynchronous CookieManager writes to finish.
3. The read tracker discarded security/authentication/network failures, ignored Retry-After, could retry transient failures forever, and left retry timers active after stopping. Late callbacks could apply to a new lifecycle.
4. Any successful HTTP status was treated as a timings acknowledgement, even if a redirect returned a login HTML document.
5. Browser verification in AccountView did not apply the returned session to the API client/workspace.
6. The browser fallback executed fetch in a synthetic blank same-origin document. This alone did not establish that the site's ordinary HTML browser initialization had run or that authenticated writing was available.
7. The user-visible failure was a short-lived toast. Production debug logs could not reliably distinguish CSRF preflight, POST, and fallback outcomes.

The real React TopicView test also established that the prior acknowledgement callback did remove blue dots after a successful response. UI rendering alone was not the explanation for the reported 403.

## Implemented correction

- Differentiate literal Discourse BAD CSRF from Cloudflare challenge and permission failures; one bounded token refresh, never generic 403 loops.
- Single-flight CSRF acquisition; generation checks prevent account changes during an asynchronous request from replaying another account's reading data.
- Wait for all CookieManager callbacks before exposing native CSRF responses; bounded failure handling.
- Retain blocked reading batches for explicit same-account recovery; bounded transient retries and Retry-After compliance; cancel stopped-session work.
- Reject redirected/nonempty HTML as a successful timings response. Apply post.read and per-post read sets only after a valid acknowledgement.
- On a challenge, make one bounded ordinary first-party HTML visit, without a JavaScriptInterface exposed to the remote page. The site's own scripts run normally. Verify current user and fresh CSRF before retrying; check that account ID and username match. No CAPTCHA automation, fingerprint spoofing, third-party credential forwarding, or suppression of genuine challenge errors.
- If a user action is required, show an in-app verification action. Keep the current batch until that same account is verified and then resume it.
- Add browser request deadlines and actual transport/response-path metadata. Show a persistent status card and a copyable allowlisted diagnostic containing build marker, phase, path, status, transport, CF-Ray, topic/post numbers, but no Cookie, CSRF, username, query string, or response body.
- Observe only real post article elements, not quoted post-reference nodes.
- Add LinuxDO behavior tests to the Android release workflow.

## Verification evidence

- `npm run test:linuxdo`: existing LinuxDO suite and 31 new JavaScript cases passed.
  - Real API client and topic service, mocking only the native network boundary: 11 passed.
  - Timing queue and lifecycle: 6 passed.
  - Exact Android-injected session probe script executed in a controlled JS context: 9 passed.
  - Real React TopicView/AccountView rendering, including blue-dot removal, preserved failure, phase display, and verification/resume: 5 passed.
- Native `LinuxDoCookieCommitTest`: 4 passed.
- Native `LinuxDoBrowserSessionRecoveryTest`: 4 passed on Robolectric Android 13.
- Initial native recovery runs failed to initialize because the additional Robolectric Android 15 compile-time runtime was missing. The exact runtime was subsequently fetched from Maven Central, SHA-256 verified, and the eight focused native tests passed. Full unrelated Android test-suite completion is not claimed.
- Release/update isolation, Chrome/WebView compatibility, hardware-back, control selection, React innerHTML stability, and project Cloudflare routing regressions passed.
- TypeScript/Vite production build passed. Existing bundle-size warnings remain.
- Lint: no errors, 18 pre-existing project warnings; no new read-sync warnings.
- Local cloud release APK built successfully and APK v2 signature verified.

## Artifact

Private test build, not a new public release. Package version remains `1.8.9-beta.3`, Android version code `10809003`.

Build marker: `readsync-20260923-r2`.

APK bytes: `3606434`.

APK SHA-256: `d609ea4b9f7e6d3d36367c83f79f917ddc05aa65e8338340081da6f125baa870`.

Signing certificate SHA-256: `94d835734e822dceb874b60f1caa13046a6116fd105d5fb97eda78790f7698b2`.

The APK was inspected to confirm the new build marker and exact session-probe asset. Production source timestamps predate the APK.

## What remains unverified

No Android device is connected to the local ADB server. The existing Pixel emulator cannot boot because its configured Android system image is missing. Consequently, this investigation has not captured the user's actual authenticated Cloudflare response or demonstrated their server-side posts_read_count increasing on a physical device.

A successful automated test or build does not establish which Linux.do WAF rule rejected the user's phone. If that server still requests an interactive challenge, the new persistent diagnostic distinguishes GET /session/csrf.json from POST /topics/timings and records the actual native/browser hop. It must not be described as a guaranteed bypass or a verified device-level fix.
