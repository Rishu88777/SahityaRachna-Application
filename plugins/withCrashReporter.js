// Expo config plugin: when the app crashes, show the device info and stack trace on screen
// (in a separate process) instead of the generic "app has a bug" system dialog.
const fs = require('fs');
const path = require('path');
const { withDangerousMod, withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const KOTLIN_REPORTER = (pkg) => `package ${pkg}

import android.app.Application
import android.content.Intent
import android.os.Build
import android.os.Process
import java.io.File
import java.io.PrintWriter
import java.io.StringWriter
import kotlin.system.exitProcess

object CrashReporter {
  fun isCrashProcess(): Boolean =
    try {
      File("/proc/self/cmdline").readText().trim { it == '\\u0000' || it == ' ' }.endsWith(":crash")
    } catch (e: Throwable) {
      false
    }

  fun install(app: Application) {
    Thread.setDefaultUncaughtExceptionHandler { thread, error ->
      try {
        val sw = StringWriter()
        error.printStackTrace(PrintWriter(sw))
        val report = "Device: \${Build.MANUFACTURER} \${Build.MODEL}\\n" +
          "Android \${Build.VERSION.RELEASE} (API \${Build.VERSION.SDK_INT})\\n" +
          "ABI: \${Build.SUPPORTED_ABIS.joinToString()}\\n" +
          "Thread: \${thread.name}\\n\\n" + sw.toString().take(20000)
        app.startActivity(
          Intent(app, CrashActivity::class.java)
            .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
            .putExtra("report", report)
        )
        Thread.sleep(400)
      } catch (ignored: Throwable) {
      }
      Process.killProcess(Process.myPid())
      exitProcess(10)
    }
  }
}
`;

const KOTLIN_ACTIVITY = (pkg) => `package ${pkg}

import android.app.Activity
import android.content.ClipData
import android.content.ClipboardManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.os.Bundle
import android.widget.Button
import android.widget.LinearLayout
import android.widget.TextView

class CrashActivity : Activity() {
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    val report = intent?.getStringExtra("report") ?: "No details available"
    val pad = (16 * resources.displayMetrics.density).toInt()

    val title = TextView(this).apply {
      text = "Sahitya Rachna stopped unexpectedly"
      textSize = 20f
      setTextColor(Color.BLACK)
    }
    val hint = TextView(this).apply {
      text = "Sorry about that. Please reopen the app. If this keeps happening, tap Copy details and send them to the developer."
      setTextColor(Color.DKGRAY)
      setPadding(0, pad / 2, 0, pad / 2)
    }
    val copy = Button(this).apply {
      text = "Copy details"
      setOnClickListener {
        (getSystemService(Context.CLIPBOARD_SERVICE) as ClipboardManager)
          .setPrimaryClip(ClipData.newPlainText("crash", report))
      }
    }
    val reopen = Button(this).apply {
      text = "Reopen app"
      setOnClickListener {
        packageManager.getLaunchIntentForPackage(packageName)?.let {
          it.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK)
          startActivity(it)
        }
        finishAndRemoveTask()
      }
    }
    val buttons = LinearLayout(this).apply {
      orientation = LinearLayout.HORIZONTAL
      addView(copy)
      addView(reopen)
    }
    setContentView(LinearLayout(this).apply {
      orientation = LinearLayout.VERTICAL
      setBackgroundColor(Color.WHITE)
      setPadding(pad, pad * 2, pad, pad)
      addView(title)
      addView(hint)
      addView(buttons)
    })
  }
}
`;

module.exports = function withCrashReporter(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const pkg = cfg.android.package;
      const dir = path.join(cfg.modRequest.platformProjectRoot, 'app/src/main/java', ...pkg.split('.'));
      fs.writeFileSync(path.join(dir, 'CrashReporter.kt'), KOTLIN_REPORTER(pkg));
      fs.writeFileSync(path.join(dir, 'CrashActivity.kt'), KOTLIN_ACTIVITY(pkg));

      const appFile = path.join(dir, 'MainApplication.kt');
      let src = fs.readFileSync(appFile, 'utf8');
      if (!src.includes('CrashReporter.install')) {
        const next = src.replace(
          /(override fun onCreate\(\) \{\n\s*super\.onCreate\(\)\n)/,
          '$1    if (CrashReporter.isCrashProcess()) return\n    CrashReporter.install(this)\n',
        );
        if (next === src) throw new Error('withCrashReporter: could not patch MainApplication.onCreate');
        fs.writeFileSync(appFile, next);
      }
      return cfg;
    },
  ]);

  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(cfg.modResults);
    app.activity = app.activity || [];
    if (!app.activity.some((a) => a.$['android:name'] === '.CrashActivity')) {
      app.activity.push({
        $: {
          'android:name': '.CrashActivity',
          'android:process': ':crash',
          'android:exported': 'false',
          'android:excludeFromRecents': 'true',
          'android:theme': '@android:style/Theme.Material.Light.NoActionBar',
        },
      });
    }
    return cfg;
  });
};
