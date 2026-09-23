package com.aizeek.newsnook;

import android.app.Activity;
import android.net.Uri;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.webkit.CookieManager;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import com.getcapacitor.JSObject;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Consumer;
import org.json.JSONObject;
import org.json.JSONTokener;

/**
 * One bounded, ordinary first-party page visit after an API challenge.
 * The server's own HTML/scripts establish browser state; no fingerprint spoofing,
 * CAPTCHA automation, third-party forwarding, or JavaScriptInterface is used.
 * An interactive challenge stays unresolved and must be completed by the user.
 */
final class LinuxDoBrowserSessionRecovery {
    private static final String ORIGIN = "https://linux.do";
    private static final long TIMEOUT_MS = 15_000L;
    private static final long COOLDOWN_MS = 30_000L;
    private final Handler handler = new Handler(Looper.getMainLooper());
    private final List<Consumer<JSObject>> waiters = new ArrayList<>();
    private WebView view;
    private Runnable poll;
    private Runnable timeout;
    private long lastAttempt = -COOLDOWN_MS;

    void prepare(Activity activity, Consumer<JSObject> completed) {
        if (activity == null || activity.isFinishing()) { completed.accept(unavailable("activity")); return; }
        if (view != null) { waiters.add(completed); return; }
        long now = SystemClock.elapsedRealtime();
        if (now - lastAttempt < COOLDOWN_MS) { completed.accept(unavailable("cooldown")); return; }
        lastAttempt = now;
        waiters.add(completed);
        try {
            final String script;
            try (InputStream stream = activity.getAssets().open("linuxdo-session-probe.js");
                 ByteArrayOutputStream output = new ByteArrayOutputStream()) {
                byte[] buffer = new byte[4096];
                for (int count; (count = stream.read(buffer)) != -1;) output.write(buffer, 0, count);
                script = new String(output.toByteArray(), StandardCharsets.UTF_8);
            }
            WebView browser = new WebView(activity);
            view = browser;
            WebSettings settings = browser.getSettings();
            settings.setJavaScriptEnabled(true);
            settings.setDomStorageEnabled(true);
            settings.setAllowFileAccess(false);
            settings.setAllowContentAccess(false);
            settings.setSupportMultipleWindows(false);
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
            CookieManager.getInstance().setAcceptCookie(true);
            CookieManager.getInstance().setAcceptThirdPartyCookies(browser, false);
            browser.setWebViewClient(new WebViewClient() {
                @Override public boolean shouldOverrideUrlLoading(WebView ignored, WebResourceRequest request) {
                    if (!request.isForMainFrame()) return false;
                    Uri target = request.getUrl();
                    return !"https".equals(target.getScheme()) || !"linux.do".equalsIgnoreCase(target.getHost());
                }
            });
            poll = new Runnable() {
                @Override public void run() {
                    if (view != browser) return;
                    browser.evaluateJavascript(script + "\nJSON.stringify(window.__newsnookSessionProbe || null);", encoded -> {
                        if (view != browser) return;
                        try {
                            Object decoded = new JSONTokener(encoded == null ? "null" : encoded).nextValue();
                            if (decoded instanceof String && !"null".equals(decoded)) {
                                JSONObject data = new JSONObject((String) decoded);
                                if (!data.optBoolean("pending", false)) {
                                    JSObject result = new JSObject();
                                    boolean ready = data.optBoolean("ready", false)
                                        && data.optInt("userId", 0) > 0
                                        && !data.optString("username", "").isEmpty()
                                        && !data.optString("csrf", "").isEmpty();
                                    result.put("ready", ready);
                                    if (ready) {
                                        result.put("username", data.getString("username"));
                                        result.put("userId", data.getInt("userId"));
                                        result.put("csrf", data.getString("csrf"));
                                        CookieManager.getInstance().flush();
                                    } else {
                                        result.put("reason", "needs-verification");
                                        result.put("phase", data.optString("phase", "session"));
                                        result.put("status", data.optInt("status", 0));
                                    }
                                    finish(result);
                                    return;
                                }
                            }
                        } catch (Exception ignored) { /* Navigation/JS not ready yet. */ }
                        handler.postDelayed(this, 250L);
                    });
                }
            };
            timeout = () -> finish(unavailable("needs-verification"));
            handler.postDelayed(timeout, TIMEOUT_MS);
            browser.loadUrl(ORIGIN + "/");
            handler.postDelayed(poll, 250L);
        } catch (Exception ignored) { finish(unavailable("unavailable")); }
    }

    void cancel() { finish(unavailable("cancelled")); }

    private void finish(JSObject result) {
        if (poll != null) handler.removeCallbacks(poll);
        if (timeout != null) handler.removeCallbacks(timeout);
        WebView previous = view;
        view = null;
        poll = null;
        timeout = null;
        if (previous != null) {
            previous.stopLoading();
            previous.setWebViewClient(null);
            previous.destroy();
        }
        List<Consumer<JSObject>> callbacks = new ArrayList<>(waiters);
        waiters.clear();
        for (Consumer<JSObject> callback : callbacks) callback.accept(result);
    }

    private static JSObject unavailable(String reason) {
        JSObject result = new JSObject();
        result.put("ready", false);
        result.put("reason", reason);
        return result;
    }
}
