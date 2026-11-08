package de.nauren.lumio;

import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** The page's side of picture in picture (src/lib/capacitor.ts): it says while a video plays, and its shape. */
@CapacitorPlugin(name = "LumioPip")
public class PipPlugin extends Plugin {
    @PluginMethod
    public void setAutoEnter(PluginCall call) {
        boolean enabled = Boolean.TRUE.equals(call.getBoolean("enabled", false));
        int width = call.getInt("width", 16);
        int height = call.getInt("height", 9);
        boolean playing = Boolean.TRUE.equals(call.getBoolean("playing", false));
        MainActivity activity = (MainActivity) getActivity();
        activity.runOnUiThread(() -> activity.setPip(enabled, width, height, playing));
        call.resolve();
    }
}
