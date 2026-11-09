package de.nauren.lumio;

import android.content.Context;
import android.media.AudioManager;
import android.provider.Settings;
import android.view.Window;
import android.view.WindowManager;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * The video player's swipe gestures (src/lib/capacitor.ts): the device's media volume, and the brightness of Lumio's
 * own window (no permission needed; the system's brightness is back once the player lets go). Values are 0..1.
 */
@CapacitorPlugin(name = "LumioSystemControls")
public class SystemControlsPlugin extends Plugin {
    private AudioManager audio() {
        return (AudioManager) getContext().getSystemService(Context.AUDIO_SERVICE);
    }

    @PluginMethod
    public void getVolume(PluginCall call) {
        AudioManager audio = audio();
        int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        JSObject result = new JSObject();
        result.put("value", max > 0 ? (double) audio.getStreamVolume(AudioManager.STREAM_MUSIC) / max : 0);
        call.resolve(result);
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        AudioManager audio = audio();
        int max = audio.getStreamMaxVolume(AudioManager.STREAM_MUSIC);
        double value = Math.max(0, Math.min(1, call.getDouble("value", 0.0)));
        // No system volume panel: the player shows its own.
        audio.setStreamVolume(AudioManager.STREAM_MUSIC, (int) Math.round(value * max), 0);
        call.resolve();
    }

    @PluginMethod
    public void getBrightness(PluginCall call) {
        float window = getActivity().getWindow().getAttributes().screenBrightness;
        double value = window;
        if (window < 0) {
            // The window follows the system: start from the system's level.
            try {
                value = Settings.System.getInt(getContext().getContentResolver(), Settings.System.SCREEN_BRIGHTNESS) / 255.0;
            } catch (Settings.SettingNotFoundException e) {
                value = 0.5;
            }
        }
        JSObject result = new JSObject();
        result.put("value", value);
        call.resolve(result);
    }

    @PluginMethod
    public void setBrightness(PluginCall call) {
        // Below about 1% the screen can go black on some devices.
        float value = (float) Math.max(0.01, Math.min(1, call.getDouble("value", 0.5)));
        getActivity().runOnUiThread(() -> {
            WindowManager.LayoutParams attributes = getActivity().getWindow().getAttributes();
            attributes.screenBrightness = value;
            getActivity().getWindow().setAttributes(attributes);
        });
        call.resolve();
    }

    /** Back to the system's brightness. */
    @PluginMethod
    public void resetBrightness(PluginCall call) {
        getActivity().runOnUiThread(() -> {
            WindowManager.LayoutParams attributes = getActivity().getWindow().getAttributes();
            attributes.screenBrightness = WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE;
            getActivity().getWindow().setAttributes(attributes);
        });
        call.resolve();
    }

    /**
     * The video player's fullscreen: no status or navigation bar. Swiped in from the edge they show only for a moment
     * and hide again by themselves (immersive), instead of staying.
     */
    @PluginMethod
    public void setImmersive(PluginCall call) {
        boolean on = Boolean.TRUE.equals(call.getBoolean("on", false));
        getActivity().runOnUiThread(() -> {
            Window window = getActivity().getWindow();
            WindowInsetsControllerCompat controller = WindowCompat.getInsetsController(window, window.getDecorView());
            if (on) {
                controller.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
                controller.hide(WindowInsetsCompat.Type.systemBars());
            } else controller.show(WindowInsetsCompat.Type.systemBars());
        });
        call.resolve();
    }
}
