package de.nauren.lumio;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/**
 * Lumio updating itself (src/lib/app-update.ts): the newer APK is downloaded in the background into the app's cache,
 * then Android's installer is opened on it (Android always asks the user to confirm an app it didn't get from a store).
 */
@CapacitorPlugin(name = "LumioUpdater")
public class UpdaterPlugin extends Plugin {
    private File target() {
        File folder = new File(getContext().getCacheDir(), "updates");
        //noinspection ResultOfMethodCallIgnored
        folder.mkdirs();
        return new File(folder, "lumio-update.apk");
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (url == null) {
            call.reject("No url");
            return;
        }
        new Thread(() -> {
            File file = target();
            File partial = new File(file.getPath() + ".part");
            try {
                // GitHub sends release files on to its file host (https to https, which this follows).
                HttpURLConnection connection = (HttpURLConnection) new URL(url).openConnection();
                connection.setInstanceFollowRedirects(true);
                connection.setConnectTimeout(15000);
                connection.setReadTimeout(30000);
                if (connection.getResponseCode() >= 400) throw new Exception("HTTP " + connection.getResponseCode());
                try (InputStream in = connection.getInputStream(); OutputStream out = new FileOutputStream(partial)) {
                    byte[] buffer = new byte[64 * 1024];
                    int read;
                    while ((read = in.read(buffer)) != -1) out.write(buffer, 0, read);
                }
                if (file.exists() && !file.delete()) throw new Exception("Old update can't be replaced");
                if (!partial.renameTo(file)) throw new Exception("Update can't be stored");
                JSObject result = new JSObject();
                result.put("path", file.getAbsolutePath());
                call.resolve(result);
            } catch (Exception error) {
                //noinspection ResultOfMethodCallIgnored
                partial.delete();
                call.reject(error.getMessage());
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        File file = target();
        if (!file.exists()) {
            call.reject("Nothing downloaded");
            return;
        }
        Context context = getContext();
        Uri uri = FileProvider.getUriForFile(context, context.getPackageName() + ".fileprovider", file);
        Intent intent = new Intent(Intent.ACTION_VIEW)
            .setDataAndType(uri, "application/vnd.android.package-archive")
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
        context.startActivity(intent);
        call.resolve();
    }
}
