package dev.peipei.jianlan;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.SharedPreferences;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.view.WindowInsets;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceError;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;
import androidx.webkit.ScriptHandler;
import androidx.webkit.WebViewCompat;
import androidx.webkit.WebViewFeature;
import java.io.InputStream;
import java.io.ByteArrayOutputStream;
import java.nio.charset.StandardCharsets;
import java.util.Set;

public final class MainActivity extends Activity {
    private static final int PAPER = Color.rgb(246, 247, 243);
    private static final int INK = Color.rgb(27, 42, 38);
    private static final int GREEN = Color.rgb(23, 107, 91);
    private static final String DOUYIN = "https://www.douyin.com/?recommend=1&from_nav=1";
    private static final String BILIBILI = "https://m.bilibili.com/";
    private static final Set<String> ORIGINS = Set.of(
        "https://*.douyin.com", "https://douyin.com", "https://*.iesdouyin.com",
        "https://*.bilibili.com", "https://bilibili.com");
    private WebView web;
    private LinearLayout browser;
    private ScrollView home;
    private FrameLayout stage;
    private TextView title, status;
    private Button cleanButton;
    private ProgressBar progress;
    private SharedPreferences prefs;
    private String cleaner, mobileUa, site = "";
    private boolean enabled, desktop, earlyScript;
    private ScriptHandler scriptHandler;
    private View fullscreen;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        prefs = getSharedPreferences("jianlan", MODE_PRIVATE);
        enabled = prefs.getBoolean("clean", true);
        desktop = false;
        try (InputStream input = getAssets().open("cleaner.js")) {
            ByteArrayOutputStream output = new ByteArrayOutputStream();
            byte[] buffer = new byte[8192];
            int length;
            while ((length = input.read(buffer)) != -1) output.write(buffer, 0, length);
            cleaner = output.toString(StandardCharsets.UTF_8.name());
        } catch (Exception error) {
            cleaner = "";
        }
        stage = new FrameLayout(this);
        stage.setBackgroundColor(PAPER);
        stage.setOnApplyWindowInsetsListener((view, insets) -> {
            if (android.os.Build.VERSION.SDK_INT >= 30) {
                android.graphics.Insets bars = insets.getInsets(
                    WindowInsets.Type.systemBars() | WindowInsets.Type.displayCutout());
                view.setPadding(bars.left, bars.top, bars.right, bars.bottom);
            } else {
                view.setPadding(insets.getSystemWindowInsetLeft(), insets.getSystemWindowInsetTop(),
                    insets.getSystemWindowInsetRight(), insets.getSystemWindowInsetBottom());
            }
            return insets;
        });
        setContentView(stage);
        makeBrowser();
        makeHome();
        showHome();
        if (android.os.Build.VERSION.SDK_INT >= 33) {
            getOnBackInvokedDispatcher().registerOnBackInvokedCallback(
                android.window.OnBackInvokedDispatcher.PRIORITY_DEFAULT, () -> {
                    if (home.getVisibility() == View.VISIBLE) finish(); else goBack();
                });
        }
    }

    private void makeHome() {
        home = new ScrollView(this);
        LinearLayout column = new LinearLayout(this);
        column.setOrientation(LinearLayout.VERTICAL);
        column.setPadding(dp(24), dp(42), dp(24), dp(30));
        TextView eyebrow = label("一处打开 · 轻松浏览", 13, GREEN);
        column.addView(eyebrow);
        TextView heading = label("简览", 42, INK);
        heading.setTypeface(null, Typeface.BOLD);
        column.addView(heading);
        TextView intro = label("常看的内容，放在一起。", 17, INK);
        intro.setPadding(0, dp(12), 0, dp(32));
        column.addView(intro);
        column.addView(siteCard("抖音", "短视频、搜索与关注", "打开抖音", DOUYIN, INK));
        column.addView(siteCard("哔哩哔哩", "搜索视频，继续观看", "打开 B 站", BILIBILI, Color.rgb(161, 66, 94)));
        TextView note = label("默认开启广告过滤，可随时关闭。\n账号直接在网站登录，下次打开仍可继续使用。", 13, Color.rgb(105, 116, 111));
        note.setLineSpacing(dp(5), 1);
        note.setPadding(0, dp(28), 0, 0);
        column.addView(note);
        home.addView(column);
        stage.addView(home, new FrameLayout.LayoutParams(-1, -1));
    }

    private View siteCard(String name, String description, String action, String url, int accent) {
        LinearLayout card = new LinearLayout(this);
        card.setOrientation(LinearLayout.VERTICAL);
        card.setPadding(dp(22), dp(22), dp(22), dp(18));
        GradientDrawable background = new GradientDrawable();
        background.setColor(Color.WHITE);
        background.setCornerRadius(dp(22));
        background.setStroke(dp(1), Color.rgb(224, 230, 223));
        card.setBackground(background);
        LinearLayout.LayoutParams params = new LinearLayout.LayoutParams(-1, -2);
        params.bottomMargin = dp(16);
        card.setLayoutParams(params);
        TextView nameView = label(name, 25, accent);
        nameView.setTypeface(null, Typeface.BOLD);
        card.addView(nameView);
        TextView detail = label(description, 14, Color.rgb(100, 110, 104));
        detail.setPadding(0, dp(8), 0, dp(20));
        card.addView(detail);
        Button open = button(action + "  ↗", v -> openSite(url));
        open.setTextColor(accent);
        card.addView(open, new LinearLayout.LayoutParams(-1, dp(48)));
        card.setOnClickListener(v -> openSite(url));
        return card;
    }

    private void makeBrowser() {
        browser = new LinearLayout(this);
        browser.setOrientation(LinearLayout.VERTICAL);
        LinearLayout toolbar = new LinearLayout(this);
        toolbar.setGravity(Gravity.CENTER_VERTICAL);
        toolbar.setPadding(dp(4), 0, dp(4), 0);
        toolbar.addView(button("‹", v -> goBack()), new LinearLayout.LayoutParams(dp(44), dp(48)));
        toolbar.addView(button("首页", v -> showHome()), new LinearLayout.LayoutParams(dp(62), dp(48)));
        title = label("", 16, INK);
        title.setSingleLine();
        title.setGravity(Gravity.CENTER);
        toolbar.addView(title, new LinearLayout.LayoutParams(0, dp(48), 1));
        cleanButton = button("过滤", v -> toggleCleaner());
        toolbar.addView(cleanButton, new LinearLayout.LayoutParams(dp(68), dp(48)));
        toolbar.addView(button("⋮", v -> showMenu()), new LinearLayout.LayoutParams(dp(44), dp(48)));
        browser.addView(toolbar);
        progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        browser.addView(progress, new LinearLayout.LayoutParams(-1, dp(2)));
        web = new WebView(this);
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setUseWideViewPort(true);
        settings.setLoadWithOverviewMode(true);
        mobileUa = settings.getUserAgentString().replace("; wv", "").replace("Version/4.0 ", "");
        applyUa();
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);
        registerCleaner();
        web.setWebViewClient(new WebViewClient() {
            @Override public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String scheme = request.getUrl().getScheme();
                if ("https".equals(scheme)) return false;
                if (request.isForMainFrame()) Toast.makeText(MainActivity.this,
                    "这个链接需要外部应用，可返回继续浏览", Toast.LENGTH_SHORT).show();
                return true;
            }
            @Override public void onPageStarted(WebView view, String url, android.graphics.Bitmap favicon) {
                if (!earlyScript && isSupported(url)) view.evaluateJavascript(currentScript(), null);
                status.setText("正在打开…");
            }
            @Override public void onPageFinished(WebView view, String url) {
                if (isSupported(url)) view.evaluateJavascript(currentScript(), null);
                CookieManager.getInstance().flush();
                updateStatus();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) status.setText("页面加载失败，可在右上角刷新重试");
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override public void onProgressChanged(WebView view, int value) {
                progress.setProgress(value);
                progress.setVisibility(value < 100 ? View.VISIBLE : View.INVISIBLE);
            }
            @Override public void onShowCustomView(View view, CustomViewCallback callback) {
                if (fullscreen != null) { callback.onCustomViewHidden(); return; }
                fullscreen = view;
                fullscreenCallback = callback;
                browser.setVisibility(View.GONE);
                stage.addView(view, new FrameLayout.LayoutParams(-1, -1));
            }
            @Override public void onHideCustomView() { exitFullscreen(); }
        });
        browser.addView(web, new LinearLayout.LayoutParams(-1, 0, 1));
        status = label("", 11, Color.rgb(105, 116, 111));
        status.setGravity(Gravity.CENTER);
        browser.addView(status, new LinearLayout.LayoutParams(-1, dp(24)));
        stage.addView(browser, new FrameLayout.LayoutParams(-1, -1));
        updateStatus();
    }

    private String currentScript() {
        return "window.__jianlanInitialEnabled=" + enabled + ";\n" + cleaner
            + "\n;window.__jianlanSetEnabled && window.__jianlanSetEnabled(" + enabled + ");";
    }

    private void registerCleaner() {
        earlyScript = WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT);
        if (WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) {
            if (scriptHandler != null) scriptHandler.remove();
            scriptHandler = WebViewCompat.addDocumentStartJavaScript(web, currentScript(), ORIGINS);
        }
    }

    private void toggleCleaner() {
        enabled = !enabled;
        prefs.edit().putBoolean("clean", enabled).apply();
        registerCleaner();
        if (isSupported(web.getUrl())) web.evaluateJavascript(currentScript(), null);
        updateStatus();
        Toast.makeText(this, enabled ? "已开启过滤" : "已关闭过滤，刷新可恢复被过滤的内容", Toast.LENGTH_SHORT).show();
    }

    private void applyUa() {
        web.getSettings().setUserAgentString(desktop
            ? mobileUa.replaceFirst("\\([^)]*\\)", "(X11; Linux x86_64)").replace(" Mobile", "")
            : mobileUa);
    }

    private void openSite(String url) {
        site = url.equals(DOUYIN) ? "抖音" : "哔哩哔哩";
        desktop = prefs.getBoolean("desktop_" + site, url.equals(DOUYIN));
        applyUa();
        title.setText(site);
        home.setVisibility(View.GONE);
        browser.setVisibility(View.VISIBLE);
        web.onResume();
        web.loadUrl(url);
        updateStatus();
    }

    private void showHome() {
        exitFullscreen();
        web.evaluateJavascript("document.querySelectorAll('video,audio').forEach(v=>v.pause())", null);
        web.onPause();
        browser.setVisibility(View.GONE);
        home.setVisibility(View.VISIBLE);
    }

    private void updateStatus() {
        cleanButton.setText(enabled ? "过滤 ✓" : "过滤 ○");
        cleanButton.setTextColor(enabled ? GREEN : Color.GRAY);
        status.setText((enabled ? "广告过滤已开启" : "广告过滤已关闭") + " · " + (desktop ? "电脑版" : "手机版"));
    }

    private void showMenu() {
        new AlertDialog.Builder(this).setTitle(site).setItems(new String[]{"刷新页面",
            desktop ? "切换到手机版网页" : "切换到电脑版网页", "打开此站首页", "关于简览"}, (dialog, which) -> {
                if (which == 0) web.reload();
                if (which == 1) {
                    desktop = !desktop;
                    prefs.edit().putBoolean("desktop_" + site, desktop).apply();
                    applyUa();
                    web.reload();
                    updateStatus();
                }
                if (which == 2) openSite(site.equals("抖音") ? DOUYIN : BILIBILI);
                if (which == 3) new AlertDialog.Builder(this).setTitle("简览 0.1.0")
                    .setMessage("把常用网站放进一个应用，并过滤已识别的页面广告。\n\n这是早期体验版。登录、画质和内容权限由各网站提供；视频内创作者口播不会跳过。")
                    .setPositiveButton("知道了", null).show();
        }).show();
    }

    private boolean isSupported(String url) {
        if (url == null) return false;
        Uri uri = Uri.parse(url);
        String host = uri.getHost();
        if (!"https".equals(uri.getScheme()) || host == null) return false;
        return host.equals("douyin.com") || host.endsWith(".douyin.com")
            || host.endsWith(".iesdouyin.com") || host.equals("bilibili.com") || host.endsWith(".bilibili.com");
    }

    private void exitFullscreen() {
        if (fullscreen == null) return;
        stage.removeView(fullscreen);
        fullscreen = null;
        browser.setVisibility(View.VISIBLE);
        fullscreenCallback.onCustomViewHidden();
        fullscreenCallback = null;
    }

    private void goBack() {
        if (fullscreen != null) exitFullscreen();
        else if (browser.getVisibility() == View.VISIBLE && web.canGoBack()) web.goBack();
        else showHome();
    }

    // Android 13+ uses the callback registered in onCreate; this handles older devices.
    @android.annotation.SuppressLint("GestureBackNavigation")
    @Override public void onBackPressed() {
        if (home.getVisibility() == View.VISIBLE) super.onBackPressed();
        else goBack();
    }
    @Override protected void onPause() {
        web.onPause();
        CookieManager.getInstance().flush();
        super.onPause();
    }
    @Override protected void onResume() {
        super.onResume();
        if (web != null && browser.getVisibility() == View.VISIBLE) web.onResume();
    }
    @Override protected void onDestroy() {
        if (scriptHandler != null && WebViewFeature.isFeatureSupported(WebViewFeature.DOCUMENT_START_SCRIPT)) scriptHandler.remove();
        web.destroy();
        super.onDestroy();
    }
    private int dp(int value) { return Math.round(value * getResources().getDisplayMetrics().density); }
    private TextView label(String text, int size, int color) {
        TextView label = new TextView(this);
        label.setText(text); label.setTextSize(size); label.setTextColor(color);
        return label;
    }
    private Button button(String text, View.OnClickListener listener) {
        Button button = new Button(this);
        button.setText(text); button.setTextSize(14); button.setAllCaps(false);
        button.setPadding(dp(4), 0, dp(4), 0);
        button.setMinWidth(0); button.setMinimumWidth(0);
        button.setBackgroundColor(Color.TRANSPARENT);
        button.setTextColor(INK); button.setOnClickListener(listener);
        return button;
    }
}
