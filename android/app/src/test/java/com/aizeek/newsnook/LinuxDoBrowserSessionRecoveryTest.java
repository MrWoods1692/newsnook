package com.aizeek.newsnook;

import static org.junit.Assert.*;
import static org.robolectric.Shadows.shadowOf;
import android.app.Activity;
import android.os.Looper;
import com.getcapacitor.JSObject;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import org.junit.Test;
import org.junit.runner.RunWith;
import org.robolectric.Robolectric;
import org.robolectric.RobolectricTestRunner;
import org.robolectric.annotation.Config;

@RunWith(RobolectricTestRunner.class)
@Config(sdk = 33)
public class LinuxDoBrowserSessionRecoveryTest {
    @Test public void navigationWithoutSuccessfulProbeNeverReportsReady() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        LinuxDoBrowserSessionRecovery recovery = new LinuxDoBrowserSessionRecovery();
        List<JSObject> results = new ArrayList<>();
        recovery.prepare(activity, results::add);
        assertEquals(0, results.size());
        shadowOf(Looper.getMainLooper()).idleFor(16, TimeUnit.SECONDS);
        assertEquals(1, results.size());
        assertFalse(results.get(0).optBoolean("ready"));
        assertFalse(results.get(0).has("csrf"));
        recovery.cancel();
        assertEquals(1, results.size());
    }

    @Test public void concurrentPreparationsShareTheSameBoundedAttempt() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        LinuxDoBrowserSessionRecovery recovery = new LinuxDoBrowserSessionRecovery();
        List<JSObject> results = new ArrayList<>();
        recovery.prepare(activity, results::add);
        recovery.prepare(activity, results::add);
        recovery.cancel();
        assertEquals(2, results.size());
        assertFalse(results.get(0).optBoolean("ready"));
        shadowOf(Looper.getMainLooper()).idleFor(16, TimeUnit.SECONDS);
        assertEquals(2, results.size());
    }

    @Test public void failedAttemptHasCooldownRatherThanOpeningPagesRepeatedly() {
        Activity activity = Robolectric.buildActivity(Activity.class).setup().get();
        LinuxDoBrowserSessionRecovery recovery = new LinuxDoBrowserSessionRecovery();
        List<JSObject> results = new ArrayList<>();
        recovery.prepare(activity, results::add);
        recovery.cancel();
        recovery.prepare(activity, results::add);
        assertEquals(2, results.size());
        assertEquals("cooldown", results.get(1).optString("reason"));
    }

    @Test public void missingActivityCannotStartARecovery() {
        LinuxDoBrowserSessionRecovery recovery = new LinuxDoBrowserSessionRecovery();
        List<JSObject> results = new ArrayList<>();
        recovery.prepare(null, results::add);
        assertEquals(1, results.size());
        assertFalse(results.get(0).optBoolean("ready"));
    }
}
