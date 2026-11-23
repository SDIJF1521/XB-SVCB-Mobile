package cn.xbsvcb.mobile;

import android.app.Activity;
import android.app.DownloadManager;
import android.content.ContentResolver;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.database.Cursor;
import android.media.MediaMetadataRetriever;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.provider.OpenableColumns;
import android.webkit.JavascriptInterface;
import android.webkit.WebView;
import android.widget.Toast;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;
import org.json.JSONTokener;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.ConnectException;
import java.net.HttpURLConnection;
import java.net.SocketTimeoutException;
import java.net.URL;
import java.net.UnknownHostException;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * JS 与 Android 原生能力之间的桥。
 *
 * 页面通过 `window.XBNative.call(method, requestId, argsJson)` 发起调用，原生
 * 完成后回调 `window.__xbNativeResult`；上传进度通过 `__xbNativeProgress` 推送。
 * 所有 HTTP 都带 API Key，避免把密钥暴露在 file:// 页面的 fetch 中。
 */
public class NativeBridge {

    public interface PickCallback {
        void onPicked(Uri uri);

        void onCancel();
    }

    private static final String PREFS_NAME = "xb_svcb_mobile";
    private static final String USER_AGENT = "XB-SVCB-Mobile/0.1.2";

    private static final class PickedFile {
        final Uri uri;
        final String name;
        final long size;
        final String mime;

        PickedFile(Uri uri, String name, long size, String mime) {
            this.uri = uri;
            this.name = name;
            this.size = size;
            this.mime = mime;
        }
    }

    private final MainActivity activity;
    private final WebView webView;
    private final SharedPreferences prefs;
    private final ExecutorService pool = Executors.newCachedThreadPool();
    private final Map<String, PickedFile> pickedFiles = new ConcurrentHashMap<>();

    NativeBridge(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
        this.prefs = activity.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
    }

    void shutdown() {
        pool.shutdownNow();
    }

    @JavascriptInterface
    public void call(String method, String requestId, String argsJson) {
        final JSONObject args;
        try {
            args = argsJson == null || argsJson.isEmpty()
                    ? new JSONObject()
                    : new JSONObject(argsJson);
        } catch (JSONException error) {
            reject(requestId, "参数解析失败", 0);
            return;
        }
        pool.execute(() -> {
            try {
                dispatch(method == null ? "" : method, requestId, args);
            } catch (Throwable error) {
                reject(requestId, friendly(error), 0);
            }
        });
    }

    private void dispatch(String method, String requestId, JSONObject args) throws Exception {
        switch (method) {
            case "config.load":
                handleConfigLoad(requestId);
                break;
            case "config.save":
                handleConfigSave(requestId, args);
                break;
            case "http":
                handleHttp(requestId, args);
                break;
            case "pick":
                handlePick(requestId);
                break;
            case "probeAudio":
                handleProbeAudio(requestId, args);
                break;
            case "upload":
                handleUpload(requestId, args);
                break;
            case "download":
                handleDownload(requestId, args);
                break;
            case "cacheAudio":
                handleCacheAudio(requestId, args);
                break;
            case "toast":
                handleToast(args);
                resolve(requestId, new JSONObject().put("shown", true));
                break;
            case "vibrate":
                handleVibrate(args.optInt("ms", 12));
                resolve(requestId, new JSONObject().put("ok", true));
                break;
            case "openUrl":
                handleOpenUrl(args.optString("url", ""));
                resolve(requestId, new JSONObject().put("ok", true));
                break;
            case "openDownloads":
                handleOpenDownloads();
                resolve(requestId, new JSONObject().put("ok", true));
                break;
            case "appInfo":
                handleAppInfo(requestId);
                break;
            case "exit":
                activity.runOnUiThread(activity::finish);
                resolve(requestId, new JSONObject().put("ok", true));
                break;
            default:
                reject(requestId, "未知的原生方法：" + method, 0);
                break;
        }
    }

    // ---------------------------------------------------------------- 配置

    private void handleConfigLoad(String requestId) throws JSONException {
        JSONObject data = new JSONObject();
        data.put("serverUrl", prefs.getString("serverUrl", ""));
        data.put("apiKey", prefs.getString("apiKey", ""));
        data.put("downloadSubdir", prefs.getString("downloadSubdir", "XB-SVCB"));
        resolve(requestId, data);
    }

    private void handleConfigSave(String requestId, JSONObject args) throws JSONException {
        SharedPreferences.Editor editor = prefs.edit();
        if (args.has("serverUrl")) {
            editor.putString("serverUrl", args.optString("serverUrl", ""));
        }
        if (args.has("apiKey")) {
            editor.putString("apiKey", args.optString("apiKey", ""));
        }
        if (args.has("downloadSubdir")) {
            editor.putString("downloadSubdir", args.optString("downloadSubdir", "XB-SVCB"));
        }
        editor.apply();
        resolve(requestId, new JSONObject().put("saved", true));
    }

    // ---------------------------------------------------------------- HTTP

    private void handleHttp(String requestId, JSONObject args) throws Exception {
        String method = args.optString("method", "GET").toUpperCase(Locale.ROOT);
        String url = args.optString("url", "");
        String apiKey = args.optString("apiKey", "");
        String body = args.optString("body", "");
        int timeout = args.optInt("timeoutMs", 30000);
        if (url.isEmpty()) {
            reject(requestId, "缺少请求地址", 0);
            return;
        }

        byte[] payload = body.isEmpty() ? null : body.getBytes(StandardCharsets.UTF_8);
        SimpleHttp.Response response = SimpleHttp.request(method, url, apiKey, payload, timeout);
        Object data = parseJson(new String(response.body, StandardCharsets.UTF_8));

        JSONObject wrapper = new JSONObject();
        wrapper.put("status", response.status);
        wrapper.put("data", data);
        if (response.status >= 200 && response.status < 300) {
            resolve(requestId, wrapper);
        } else {
            reject(requestId, detailOf(data, response.status), response.status);
        }
    }

    // ---------------------------------------------------------------- 文件选择

    private void handlePick(String requestId) {
        activity.pickAudio(new PickCallback() {
            @Override
            public void onPicked(Uri uri) {
                pool.execute(() -> {
                    try {
                        String name = queryName(uri);
                        long size = querySize(uri);
                        String mime = activity.getContentResolver().getType(uri);
                        if (mime == null || mime.isEmpty()) {
                            mime = guessMime(name);
                        }
                        String token = "file-" + UUID.randomUUID().toString().replace("-", "");
                        pickedFiles.put(token, new PickedFile(uri, name, size, mime));

                        JSONObject data = new JSONObject();
                        data.put("token", token);
                        data.put("name", name);
                        data.put("size", size);
                        data.put("mime", mime);
                        resolve(requestId, data);
                    } catch (Exception error) {
                        reject(requestId, "无法读取所选文件：" + friendly(error), 0);
                    }
                });
            }

            @Override
            public void onCancel() {
                reject(requestId, "已取消选择", 0);
            }
        });
    }

    // ---------------------------------------------------------------- 上传

    private void handleProbeAudio(String requestId, JSONObject args) {
        PickedFile file = pickedFiles.get(args.optString("token", ""));
        if (file == null) {
            reject(requestId, "文件已失效，请重新选择", 0);
            return;
        }
        MediaMetadataRetriever retriever = new MediaMetadataRetriever();
        try {
            retriever.setDataSource(activity, file.uri);
            String raw = retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION);
            double seconds = raw == null ? 0 : Double.parseDouble(raw) / 1000.0;
            JSONObject data = new JSONObject();
            data.put("duration", Math.max(0, Math.round(seconds * 10) / 10.0));
            resolve(requestId, data);
        } catch (Exception error) {
            reject(requestId, "无法读取音频时长", 0);
        } finally {
            try {
                retriever.release();
            } catch (Exception ignored) {
                // 部分机型 release 可能抛异常，忽略即可。
            }
        }
    }

    private void handleUpload(String requestId, JSONObject args) throws Exception {
        String token = args.optString("token", "");
        String url = args.optString("url", "");
        String apiKey = args.optString("apiKey", "");
        PickedFile file = pickedFiles.get(token);
        if (file == null) {
            reject(requestId, "文件已失效，请重新选择", 0);
            return;
        }
        if (url.isEmpty()) {
            reject(requestId, "缺少上传地址", 0);
            return;
        }

        String boundary = "----XBSVCB" + UUID.randomUUID().toString().replace("-", "");
        String head = "--" + boundary + "\r\n"
                + "Content-Disposition: form-data; name=\"file\"; filename=\""
                + escapeFilename(file.name) + "\"\r\n"
                + "Content-Type: " + (file.mime == null ? "application/octet-stream" : file.mime)
                + "\r\n\r\n";
        String tail = "\r\n--" + boundary + "--\r\n";
        byte[] headBytes = head.getBytes(StandardCharsets.UTF_8);
        byte[] tailBytes = tail.getBytes(StandardCharsets.UTF_8);
        long expectedLength = headBytes.length + file.size + tailBytes.length;

        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("POST");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(180000);
            connection.setDoOutput(true);
            if (file.size > 0) {
                connection.setFixedLengthStreamingMode(expectedLength);
            } else {
                connection.setChunkedStreamingMode(64 * 1024);
            }
            connection.setRequestProperty("Content-Type", "multipart/form-data; boundary=" + boundary);
            connection.setRequestProperty("Accept", "application/json");
            connection.setRequestProperty("User-Agent", USER_AGENT);
            if (!apiKey.isEmpty()) {
                connection.setRequestProperty("X-API-Key", apiKey);
            }

            try (OutputStream raw = connection.getOutputStream();
                 BufferedOutputStream out = new BufferedOutputStream(raw, 64 * 1024)) {
                out.write(headBytes);

                InputStream input = activity.getContentResolver().openInputStream(file.uri);
                if (input == null) {
                    throw new IOException("无法读取所选文件");
                }
                try (InputStream in = new BufferedInputStream(input, 64 * 1024)) {
                    byte[] buffer = new byte[64 * 1024];
                    long total = file.size;
                    long sent = 0;
                    int lastPercent = -1;
                    int read;
                    while ((read = in.read(buffer)) != -1) {
                        out.write(buffer, 0, read);
                        sent += read;
                        if (total > 0) {
                            int percent = (int) Math.min(100, sent * 100 / total);
                            if (percent != lastPercent) {
                                lastPercent = percent;
                                emitProgress(requestId, percent, sent, total);
                            }
                        }
                    }
                }
                out.write(tailBytes);
                out.flush();
            }

            int status = connection.getResponseCode();
            String text = readText(status >= 400 ? connection.getErrorStream() : connection.getInputStream());
            Object data = parseJson(text);
            if (status >= 200 && status < 300) {
                resolve(requestId, data);
            } else {
                reject(requestId, detailOf(data, status), status);
            }
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
        }
    }

    // ---------------------------------------------------------------- 系统下载

    private void handleDownload(String requestId, JSONObject args) throws Exception {
        String url = args.optString("url", "");
        String apiKey = args.optString("apiKey", "");
        String filename = sanitizeFilename(args.optString("filename", "cover.wav"));
        String subdir = sanitizeSubdir(args.optString("subdir", "XB-SVCB"));
        if (url.isEmpty()) {
            reject(requestId, "缺少下载地址", 0);
            return;
        }

        DownloadManager manager = (DownloadManager) activity.getSystemService(Context.DOWNLOAD_SERVICE);
        if (manager == null) {
            reject(requestId, "系统下载服务不可用", 0);
            return;
        }

        DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
        request.setTitle(filename);
        request.setDescription("XB-SVCB 素材下载");
        request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
        request.setAllowedOverMetered(true);
        request.setAllowedOverRoaming(true);
        if (!apiKey.isEmpty()) {
            request.addRequestHeader("X-API-Key", apiKey);
        }
        request.setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, subdir + "/" + filename);

        long downloadId = manager.enqueue(request);
        JSONObject data = new JSONObject();
        data.put("downloadId", downloadId);
        data.put("filename", filename);
        data.put("path", subdir + "/" + filename);
        resolve(requestId, data);
    }

    // ---------------------------------------------------------------- 音频缓存

    private void handleCacheAudio(String requestId, JSONObject args) throws Exception {
        String url = args.optString("url", "");
        String apiKey = args.optString("apiKey", "");
        String cacheKey = sanitizeToken(args.optString("cacheKey", "audio"));
        String extension = sanitizeExtension(args.optString("extension", "wav"));
        if (url.isEmpty()) {
            reject(requestId, "缺少音频地址", 0);
            return;
        }

        File directory = new File(activity.getCacheDir(), "audio");
        if (!directory.isDirectory() && !directory.mkdirs()) {
            reject(requestId, "无法创建音频缓存目录", 0);
            return;
        }
        File target = new File(directory, cacheKey + "." + extension);
        if (target.isFile() && target.length() > 0) {
            JSONObject cached = new JSONObject();
            cached.put("path", Uri.fromFile(target).toString());
            cached.put("size", target.length());
            resolve(requestId, cached);
            return;
        }

        File temp = new File(directory, cacheKey + "." + extension + ".part");
        HttpURLConnection connection = null;
        try {
            connection = (HttpURLConnection) new URL(url).openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(15000);
            connection.setReadTimeout(60000);
            connection.setRequestProperty("Accept", "audio/*");
            connection.setRequestProperty("User-Agent", USER_AGENT);
            if (!apiKey.isEmpty()) {
                connection.setRequestProperty("X-API-Key", apiKey);
            }

            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                String text = readText(connection.getErrorStream());
                reject(requestId, detailOf(parseJson(text), status), status);
                return;
            }

            long total = connection.getContentLengthLong();
            long received = 0;
            int lastPercent = -1;
            try (InputStream in = new BufferedInputStream(connection.getInputStream(), 64 * 1024);
                 OutputStream out = new BufferedOutputStream(new FileOutputStream(temp), 64 * 1024)) {
                byte[] buffer = new byte[64 * 1024];
                int read;
                while ((read = in.read(buffer)) != -1) {
                    out.write(buffer, 0, read);
                    received += read;
                    if (total > 0) {
                        int percent = (int) Math.min(100, received * 100 / total);
                        if (percent != lastPercent) {
                            lastPercent = percent;
                            emitProgress(requestId, percent, received, total);
                        }
                    }
                }
            }

            if (target.exists() && !target.delete()) {
                throw new IOException("无法替换旧缓存");
            }
            if (!temp.renameTo(target)) {
                throw new IOException("无法写入音频缓存");
            }

            JSONObject data = new JSONObject();
            data.put("path", Uri.fromFile(target).toString());
            data.put("size", target.length());
            resolve(requestId, data);
        } finally {
            if (connection != null) {
                connection.disconnect();
            }
            if (temp.exists()) {
                //noinspection ResultOfMethodCallIgnored
                temp.delete();
            }
        }
    }

    // ---------------------------------------------------------------- 轻量系统调用

    private void handleToast(JSONObject args) {
        String message = args.optString("message", "");
        if (message.isEmpty()) {
            return;
        }
        activity.runOnUiThread(() -> Toast.makeText(activity, message, Toast.LENGTH_SHORT).show());
    }

    private void handleVibrate(int milliseconds) {
        Vibrator vibrator = (Vibrator) activity.getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) {
            return;
        }
        int duration = Math.max(1, Math.min(80, milliseconds));
        vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
    }

    private void handleOpenUrl(String url) {
        if (url == null || url.isEmpty()) {
            return;
        }
        String lower = url.toLowerCase(Locale.ROOT);
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) {
            return;
        }
        Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            activity.startActivity(intent);
        } catch (Exception ignored) {
            // 没有浏览器时保持应用内页面不变。
        }
    }

    private void handleOpenDownloads() {
        Intent intent = new Intent(DownloadManager.ACTION_VIEW_DOWNLOADS);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        try {
            activity.startActivity(intent);
        } catch (Exception ignored) {
            // 个别定制系统没有下载管理器界面。
        }
    }

    private void handleAppInfo(String requestId) throws Exception {
        String version = "0.1.2";
        try {
            version = activity.getPackageManager()
                    .getPackageInfo(activity.getPackageName(), 0).versionName;
        } catch (Exception ignored) {
            // 保持默认版本号。
        }
        JSONObject data = new JSONObject();
        data.put("version", version);
        data.put("sdk", Build.VERSION.SDK_INT);
        data.put("device", Build.MANUFACTURER + " " + Build.MODEL);
        resolve(requestId, data);
    }

    // ---------------------------------------------------------------- 工具

    private void resolve(String requestId, Object data) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("ok", true);
            payload.put("data", data == null ? JSONObject.NULL : data);
            emit(requestId, true, payload);
        } catch (JSONException error) {
            reject(requestId, "生成原生响应失败", 0);
        }
    }

    private void reject(String requestId, String message, int status) {
        try {
            JSONObject payload = new JSONObject();
            payload.put("ok", false);
            payload.put("error", message == null || message.isEmpty() ? "原生调用失败" : message);
            payload.put("status", status);
            emit(requestId, false, payload);
        } catch (JSONException ignored) {
            // 连错误对象都无法构造时不再重试。
        }
    }

    private void emit(String requestId, boolean ok, JSONObject payload) {
        String script = "window.__xbNativeResult&&window.__xbNativeResult("
                + JSONObject.quote(requestId) + "," + ok + ","
                + JSONObject.quote(payload.toString()) + ")";
        postScript(script);
    }

    private void emitProgress(String requestId, int percent, long received, long total) {
        String script = "window.__xbNativeProgress&&window.__xbNativeProgress("
                + JSONObject.quote(requestId) + "," + percent + ","
                + received + "," + total + ")";
        postScript(script);
    }

    private void postScript(String script) {
        try {
            webView.post(() -> {
                try {
                    webView.evaluateJavascript(script, null);
                } catch (Throwable ignored) {
                    // 页面已销毁。
                }
            });
        } catch (Throwable ignored) {
            // WebView 已不可用。
        }
    }

    private static Object parseJson(String text) {
        if (text == null || text.trim().isEmpty()) {
            return JSONObject.NULL;
        }
        try {
            return new JSONTokener(text).nextValue();
        } catch (JSONException error) {
            return text;
        }
    }

    private static String detailOf(Object data, int status) {
        if (data instanceof JSONObject) {
            Object detail = ((JSONObject) data).opt("detail");
            if (detail instanceof String && !((String) detail).isEmpty()) {
                return (String) detail;
            }
            if (detail instanceof JSONArray) {
                JSONArray array = (JSONArray) detail;
                if (array.length() > 0) {
                    Object first = array.opt(0);
                    if (first instanceof JSONObject) {
                        String message = ((JSONObject) first).optString("msg", "");
                        if (!message.isEmpty()) {
                            return message;
                        }
                    }
                }
            }
        }
        switch (status) {
            case 401:
                return "API Key 无效或已过期";
            case 404:
                return "资源不存在";
            case 409:
                return "当前状态不允许该操作";
            case 415:
                return "不支持的文件格式";
            case 422:
                return "请求参数不正确";
            default:
                return "请求失败（HTTP " + status + "）";
        }
    }

    private static String friendly(Throwable error) {
        if (error instanceof UnknownHostException) {
            return "无法解析服务器地址，请检查局域网地址";
        }
        if (error instanceof ConnectException) {
            return "无法连接服务器，请确认电脑端服务已启动";
        }
        if (error instanceof SocketTimeoutException) {
            return "连接超时，请检查网络或服务状态";
        }
        if (error instanceof javax.net.ssl.SSLException) {
            return "HTTPS 证书校验失败";
        }
        String message = error.getMessage();
        return message == null || message.isEmpty() ? "原生调用失败" : message;
    }

    private String queryName(Uri uri) {
        ContentResolver resolver = activity.getContentResolver();
        try (Cursor cursor = resolver.query(uri, new String[]{OpenableColumns.DISPLAY_NAME}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.DISPLAY_NAME);
                if (index >= 0) {
                    String name = cursor.getString(index);
                    if (name != null && !name.isEmpty()) {
                        return name;
                    }
                }
            }
        } catch (Exception ignored) {
            // 使用回退名称。
        }
        String fallback = uri.getLastPathSegment();
        return fallback == null || fallback.isEmpty() ? "audio" : fallback;
    }

    private long querySize(Uri uri) {
        ContentResolver resolver = activity.getContentResolver();
        try (Cursor cursor = resolver.query(uri, new String[]{OpenableColumns.SIZE}, null, null, null)) {
            if (cursor != null && cursor.moveToFirst()) {
                int index = cursor.getColumnIndex(OpenableColumns.SIZE);
                if (index >= 0 && !cursor.isNull(index)) {
                    return cursor.getLong(index);
                }
            }
        } catch (Exception ignored) {
            // 未知大小时按 0 处理，进度条仍会显示已传输字节。
        }
        return 0L;
    }

    private static String guessMime(String name) {
        String lower = name == null ? "" : name.toLowerCase(Locale.ROOT);
        if (lower.endsWith(".mp3")) return "audio/mpeg";
        if (lower.endsWith(".wav")) return "audio/wav";
        if (lower.endsWith(".flac")) return "audio/flac";
        if (lower.endsWith(".m4a")) return "audio/mp4";
        if (lower.endsWith(".ogg")) return "audio/ogg";
        if (lower.endsWith(".opus")) return "audio/opus";
        if (lower.endsWith(".aac")) return "audio/aac";
        if (lower.endsWith(".webm")) return "audio/webm";
        if (lower.endsWith(".mp4")) return "video/mp4";
        return "application/octet-stream";
    }

    private static String escapeFilename(String name) {
        if (name == null || name.isEmpty()) {
            return "audio";
        }
        return name.replace("\\", "_").replace("\"", "'")
                .replace("\r", "").replace("\n", "");
    }

    private static String sanitizeFilename(String value) {
        String name = value == null ? "" : value;
        name = name.replaceAll("[\\\\/:*?\"<>|\\r\\n\\t]", " ").replaceAll("\\s+", " ").trim();
        if (name.isEmpty()) {
            name = "cover.wav";
        }
        return name.length() > 120 ? name.substring(0, 120) : name;
    }

    private static String sanitizeSubdir(String value) {
        String subdir = value == null ? "" : value.trim().replace('\\', '/');
        StringBuilder builder = new StringBuilder();
        for (String part : subdir.split("/")) {
            String cleaned = part.trim();
            if (cleaned.isEmpty() || ".".equals(cleaned) || "..".equals(cleaned)) {
                continue;
            }
            if (builder.length() > 0) {
                builder.append('/');
            }
            builder.append(cleaned);
        }
        return builder.length() == 0 ? "XB-SVCB" : builder.toString();
    }

    private static String sanitizeToken(String value) {
        String token = value == null ? "" : value.replaceAll("[^A-Za-z0-9._-]", "_");
        return token.isEmpty() ? "audio" : token;
    }

    private static String sanitizeExtension(String value) {
        String extension = value == null ? "" : value.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
        return extension.isEmpty() ? "wav" : extension;
    }

    private static void writeUtf8(OutputStream out, String text) throws IOException {
        out.write(text.getBytes(StandardCharsets.UTF_8));
    }

    private static String readText(InputStream input) throws IOException {
        if (input == null) {
            return "";
        }
        try (InputStream in = input; ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            byte[] buffer = new byte[8192];
            int read;
            while ((read = in.read(buffer)) != -1) {
                out.write(buffer, 0, read);
            }
            return out.toString(StandardCharsets.UTF_8.name());
        }
    }
}
