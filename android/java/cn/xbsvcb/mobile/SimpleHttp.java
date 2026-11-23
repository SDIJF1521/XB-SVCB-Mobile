package cn.xbsvcb.mobile;

import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.ByteArrayOutputStream;
import java.io.EOFException;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.Socket;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.Locale;
import java.util.Map;

import javax.net.ssl.SSLParameters;
import javax.net.ssl.SSLSocket;
import javax.net.ssl.SSLSocketFactory;

/**
 * 极简 HTTP/1.1 客户端。
 *
 * Android 自带的 HttpURLConnection 不支持 PATCH，而 FastAPI 的重命名接口
 * 使用 PATCH。这里用 Socket 直接实现请求，覆盖 GET/POST/PATCH/DELETE，
 * 仅用于返回 JSON 的轻量请求；上传与音频缓存仍走 HttpURLConnection。
 */
final class SimpleHttp {

    static final class Response {
        final int status;
        final Map<String, String> headers;
        final byte[] body;

        Response(int status, Map<String, String> headers, byte[] body) {
            this.status = status;
            this.headers = headers;
            this.body = body;
        }
    }

    private SimpleHttp() {
    }

    static Response request(String method, String url, String apiKey, byte[] body, int timeoutMs)
            throws IOException {
        URL target = new URL(url);
        String protocol = target.getProtocol().toLowerCase(Locale.ROOT);
        boolean secure = "https".equals(protocol);
        if (!secure && !"http".equals(protocol)) {
            throw new IOException("不支持的协议：" + protocol);
        }

        String host = target.getHost();
        int port = target.getPort() > 0 ? target.getPort() : (secure ? 443 : 80);
        String path = target.getFile();
        if (path == null || path.isEmpty()) {
            path = "/";
        }

        Socket socket = new Socket();
        try {
            socket.connect(new InetSocketAddress(host, port), 8000);
            socket.setSoTimeout(Math.max(1000, timeoutMs));

            if (secure) {
                SSLSocketFactory factory = (SSLSocketFactory) SSLSocketFactory.getDefault();
                SSLSocket ssl = (SSLSocket) factory.createSocket(socket, host, port, true);
                SSLParameters parameters = ssl.getSSLParameters();
                parameters.setEndpointIdentificationAlgorithm("HTTPS");
                ssl.setSSLParameters(parameters);
                ssl.startHandshake();
                socket = ssl;
            }

            OutputStream rawOut = new BufferedOutputStream(socket.getOutputStream(), 16 * 1024);
            String hostHeader = host.indexOf(':') >= 0 ? "[" + host + "]" : host;
            StringBuilder head = new StringBuilder();
            head.append(method).append(' ').append(path).append(" HTTP/1.1\r\n");
            head.append("Host: ").append(hostHeader);
            if ((secure && port != 443) || (!secure && port != 80)) {
                head.append(':').append(port);
            }
            head.append("\r\n");
            head.append("Accept: application/json, */*\r\n");
            head.append("Accept-Encoding: identity\r\n");
            head.append("Connection: close\r\n");
            head.append("User-Agent: XB-SVCB-Mobile/0.1.2\r\n");
            if (apiKey != null && !apiKey.isEmpty()) {
                head.append("X-API-Key: ").append(apiKey).append("\r\n");
            }
            int bodyLength = body == null ? 0 : body.length;
            if (bodyLength > 0) {
                head.append("Content-Type: application/json; charset=utf-8\r\n");
            }
            head.append("Content-Length: ").append(bodyLength).append("\r\n\r\n");

            rawOut.write(head.toString().getBytes(StandardCharsets.UTF_8));
            if (bodyLength > 0) {
                rawOut.write(body);
            }
            rawOut.flush();

            InputStream in = new BufferedInputStream(socket.getInputStream(), 16 * 1024);
            String statusLine = readLine(in);
            if (statusLine == null || !statusLine.startsWith("HTTP/")) {
                throw new IOException("服务器返回了无效的 HTTP 响应");
            }
            String[] statusParts = statusLine.split(" ", 3);
            int status = Integer.parseInt(statusParts[1].trim());

            Map<String, String> headers = new HashMap<>();
            String line;
            while ((line = readLine(in)) != null && !line.isEmpty()) {
                int colon = line.indexOf(':');
                if (colon <= 0) {
                    continue;
                }
                String name = line.substring(0, colon).trim().toLowerCase(Locale.ROOT);
                String value = line.substring(colon + 1).trim();
                headers.put(name, value);
            }

            ByteArrayOutputStream bodyOut = new ByteArrayOutputStream();
            String transferEncoding = headers.get("transfer-encoding");
            if (transferEncoding != null
                    && transferEncoding.toLowerCase(Locale.ROOT).contains("chunked")) {
                readChunked(in, bodyOut);
            } else {
                String contentLength = headers.get("content-length");
                if (contentLength != null) {
                    long length = Long.parseLong(contentLength.trim());
                    copyExactly(in, bodyOut, length);
                } else {
                    copyToEnd(in, bodyOut);
                }
            }

            return new Response(status, headers, bodyOut.toByteArray());
        } finally {
            try {
                socket.close();
            } catch (IOException ignored) {
                // 连接已关闭。
            }
        }
    }

    private static void readChunked(InputStream in, ByteArrayOutputStream out) throws IOException {
        while (true) {
            String line = readLine(in);
            if (line == null) {
                break;
            }
            int semicolon = line.indexOf(';');
            String sizeText = (semicolon >= 0 ? line.substring(0, semicolon) : line).trim();
            if (sizeText.isEmpty()) {
                continue;
            }
            int size = Integer.parseInt(sizeText, 16);
            if (size == 0) {
                // 读取 trailer 直到空行。
                while ((line = readLine(in)) != null && !line.isEmpty()) {
                    // 忽略 trailer。
                }
                break;
            }
            copyExactly(in, out, size);
            readLine(in);
        }
    }

    private static void copyExactly(InputStream in, ByteArrayOutputStream out, long length)
            throws IOException {
        byte[] buffer = new byte[8192];
        long remaining = length;
        while (remaining > 0) {
            int read = in.read(buffer, 0, (int) Math.min(buffer.length, remaining));
            if (read < 0) {
                throw new EOFException("响应体提前结束");
            }
            out.write(buffer, 0, read);
            remaining -= read;
        }
    }

    private static void copyToEnd(InputStream in, ByteArrayOutputStream out) throws IOException {
        byte[] buffer = new byte[8192];
        int read;
        while ((read = in.read(buffer)) >= 0) {
            out.write(buffer, 0, read);
        }
    }

    private static String readLine(InputStream in) throws IOException {
        ByteArrayOutputStream buffer = new ByteArrayOutputStream(64);
        int value;
        boolean any = false;
        while ((value = in.read()) != -1) {
            any = true;
            if (value == '\n') {
                break;
            }
            if (value != '\r') {
                buffer.write(value);
            }
        }
        if (!any && buffer.size() == 0) {
            return null;
        }
        return buffer.toString("ISO-8859-1");
    }
}
