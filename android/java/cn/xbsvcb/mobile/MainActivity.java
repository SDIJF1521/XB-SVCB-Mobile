package cn.xbsvcb.mobile;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/**
 * 单 Activity + WebView 的移动端外壳。
 *
 * 页面仍然是用 Vue 构建的移动工作台，运行在本地 assets 中；与桌面端共享
 * 同一套 FastAPI，因此不需要为手机单独维护一套业务逻辑。所有网络、文件
 * 选择、上传与下载都通过 {@link NativeBridge} 走原生通道。
 */
public class MainActivity extends Activity {

    private static final String APP_URL = "file:///android_asset/www/index.html";
    private static final int REQ_PICK = 1001;
    private static final int REQ_WEB_FILE = 1002;

    private WebView webView;
    private NativeBridge bridge;
    private ValueCallback<Uri[]> webFileCallback;
    private NativeBridge.PickCallback pendingPick;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        Window window = getWindow();
        window.setStatusBarColor(Color.parseColor("#05060D"));
        window.setNavigationBarColor(Color.parseColor("#05060D"));
        window.getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_LAYOUT_STABLE);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            window.getAttributes().layoutInDisplayCutoutMode =
                    android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_NEVER;
        }

        webView = new WebView(this);
        webView.setBackgroundColor(Color.parseColor("#05060D"));
        configureWebView(webView);

        bridge = new NativeBridge(this, webView);
        webView.addJavascriptInterface(bridge, "XBNative");

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                String scheme = uri.getScheme() == null ? "" : uri.getScheme();
                if ("file".equals(scheme) || "about".equals(scheme)
                        || "data".equals(scheme) || "blob".equals(scheme)) {
                    return false;
                }
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, uri));
                } catch (ActivityNotFoundException ignored) {
                    // 没有可处理该链接的应用时保持页面不跳转。
                }
                return true;
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback,
                                             FileChooserParams params) {
                if (webFileCallback != null) {
                    webFileCallback.onReceiveValue(null);
                }
                webFileCallback = callback;
                Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("audio/*");
                try {
                    startActivityForResult(intent, REQ_WEB_FILE);
                } catch (ActivityNotFoundException error) {
                    webFileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        setContentView(webView);

        if (isDebuggable()) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView.loadUrl(APP_URL);
    }

    private void configureWebView(WebView view) {
        WebSettings settings = view.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setAllowFileAccessFromFileURLs(true);
        settings.setAllowUniversalAccessFromFileURLs(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        settings.setTextZoom(100);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setDisplayZoomControls(false);
        settings.setLoadWithOverviewMode(false);
        settings.setUseWideViewPort(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setUserAgentString(settings.getUserAgentString() + " XBSVCBMobile/0.1.2");
    }

    private boolean isDebuggable() {
        return (getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0;
    }

    /** 打开系统文件选择器，供 JS 桥的 pick 调用。 */
    void pickAudio(NativeBridge.PickCallback callback) {
        if (pendingPick != null) {
            pendingPick.onCancel();
        }
        pendingPick = callback;
        runOnUiThread(() -> {
            Intent intent = new Intent(Intent.ACTION_OPEN_DOCUMENT);
            intent.addCategory(Intent.CATEGORY_OPENABLE);
            intent.setType("audio/*");
            try {
                startActivityForResult(intent, REQ_PICK);
            } catch (ActivityNotFoundException error) {
                NativeBridge.PickCallback current = pendingPick;
                pendingPick = null;
                if (current != null) {
                    current.onCancel();
                }
            }
        });
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode == REQ_PICK) {
            NativeBridge.PickCallback callback = pendingPick;
            pendingPick = null;
            if (callback == null) {
                return;
            }
            Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
            if (uri != null) {
                callback.onPicked(uri);
            } else {
                callback.onCancel();
            }
            return;
        }
        if (requestCode == REQ_WEB_FILE) {
            ValueCallback<Uri[]> callback = webFileCallback;
            webFileCallback = null;
            if (callback == null) {
                return;
            }
            Uri uri = resultCode == RESULT_OK && data != null ? data.getData() : null;
            callback.onReceiveValue(uri == null ? null : new Uri[]{uri});
        }
    }

    @Override
    public void onBackPressed() {
        if (webView == null) {
            super.onBackPressed();
            return;
        }
        // 先询问页面是否消费返回键（关闭弹层 / 回到任务页），未消费时再退出。
        webView.evaluateJavascript(
                "(function(){try{return window.__handleBack?window.__handleBack():false}catch(e){return false}})()",
                value -> {
                    if (!"true".equals(value)) {
                        if (webView.canGoBack()) {
                            webView.goBack();
                        } else {
                            finish();
                        }
                    }
                });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            webView.resumeTimers();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (bridge != null) {
            bridge.shutdown();
        }
        if (webView != null) {
            webView.removeJavascriptInterface("XBNative");
            webView.destroy();
            webView = null;
        }
        super.onDestroy();
    }
}
