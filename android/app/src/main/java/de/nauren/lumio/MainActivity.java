package de.nauren.lumio;

import android.app.PendingIntent;
import android.app.PictureInPictureParams;
import android.app.RemoteAction;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.content.res.Configuration;
import android.graphics.drawable.Icon;
import android.os.Build;
import android.os.Bundle;
import android.util.Rational;
import androidx.core.content.ContextCompat;
import com.getcapacitor.BridgeActivity;
import java.util.ArrayList;
import java.util.List;

/**
 * Lumio's WebView, plus Android's picture in picture: while a video plays (the page says so through PipPlugin), leaving
 * the app shrinks it into a floating window with play/pause and skip buttons. The page learns when it is in there
 * ("lumiopip") and which button was pressed ("lumiopipaction").
 */
public class MainActivity extends BridgeActivity {
    static final String PIP_ACTION = "de.nauren.lumio.PIP_ACTION";

    private boolean pipEnabled = false;
    private boolean pipPlaying = false;
    private Rational pipAspect = new Rational(16, 9);

    private final BroadcastReceiver pipReceiver = new BroadcastReceiver() {
        @Override
        public void onReceive(Context context, Intent intent) {
            String action = intent.getStringExtra("action");
            if (action != null && bridge != null) bridge.triggerWindowJSEvent("lumiopipaction", "{\"action\":\"" + action + "\"}");
        }
    };

    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(PipPlugin.class);
        super.onCreate(savedInstanceState);
        ContextCompat.registerReceiver(this, pipReceiver, new IntentFilter(PIP_ACTION), ContextCompat.RECEIVER_NOT_EXPORTED);
    }

    @Override
    public void onDestroy() {
        unregisterReceiver(pipReceiver);
        super.onDestroy();
    }

    /** From PipPlugin: whether leaving should shrink the video, its shape, and whether it plays (for the button). */
    void setPip(boolean enabled, int width, int height, boolean playing) {
        pipEnabled = enabled;
        pipPlaying = playing;
        if (width > 0 && height > 0) {
            // Android only allows shapes between 1:2.39 and 2.39:1.
            float ratio = Math.max(1 / 2.39f, Math.min(2.39f, (float) width / height));
            pipAspect = new Rational(Math.round(ratio * 1000), 1000);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            try {
                setPictureInPictureParams(pipParams());
            } catch (IllegalStateException ignored) {
                // Not allowed right now (e.g. while finishing).
            }
        }
    }

    private PictureInPictureParams pipParams() {
        PictureInPictureParams.Builder builder = new PictureInPictureParams.Builder().setAspectRatio(pipAspect).setActions(pipActions());
        // Android 12+: the system shrinks the app itself, smoothly, when it is left.
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) builder.setAutoEnterEnabled(pipEnabled).setSeamlessResizeEnabled(true);
        return builder.build();
    }

    private List<RemoteAction> pipActions() {
        List<RemoteAction> actions = new ArrayList<>();
        actions.add(pipAction("back", android.R.drawable.ic_media_rew, "Back", 1));
        actions.add(pipPlaying ? pipAction("playpause", android.R.drawable.ic_media_pause, "Pause", 2) : pipAction("playpause", android.R.drawable.ic_media_play, "Play", 2));
        actions.add(pipAction("forward", android.R.drawable.ic_media_ff, "Forward", 3));
        return actions;
    }

    private RemoteAction pipAction(String action, int icon, String title, int requestCode) {
        Intent intent = new Intent(PIP_ACTION).setPackage(getPackageName()).putExtra("action", action);
        PendingIntent pending = PendingIntent.getBroadcast(this, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE);
        return new RemoteAction(Icon.createWithResource(this, icon), title, title, pending);
    }

    /** Before Android 12 the app has to enter the window itself when the user leaves (home button, recent apps). */
    @Override
    protected void onUserLeaveHint() {
        super.onUserLeaveHint();
        if (pipEnabled && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O && Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
            try {
                enterPictureInPictureMode(pipParams());
            } catch (IllegalStateException ignored) {
                // The device has picture in picture switched off for Lumio.
            }
        }
    }

    /** The floating window's close button stops the activity while still in it: the video pauses. */
    @Override
    public void onStop() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N && isInPictureInPictureMode() && bridge != null) {
            bridge.triggerWindowJSEvent("lumiopipaction", "{\"action\":\"close\"}");
        }
        super.onStop();
    }

    @Override
    public void onPictureInPictureModeChanged(boolean inPip, Configuration newConfig) {
        super.onPictureInPictureModeChanged(inPip, newConfig);
        if (bridge != null) bridge.triggerWindowJSEvent("lumiopip", "{\"inPip\":" + inPip + "}");
    }
}
