package com.shieldlink.vpn;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import android.util.Log;

public class L {
    private static final String PUBLIC_DOWNLOAD_PATH = "/storage/emulated/0/Download/vpn_debug_log.txt";
    private static final String APP_PRIVATE_PATH = "/storage/emulated/0/Android/data/com.shieldlink.vpn/files/vpn_debug_log.txt";

    public static synchronized void log(String tag, String message) {
        Log.d(tag, message);
        writeLog(PUBLIC_DOWNLOAD_PATH, tag, message, null);
        writeLog(APP_PRIVATE_PATH, tag, message, null);
    }

    public static synchronized void log(String tag, String message, Throwable t) {
        Log.e(tag, message, t);
        writeLog(PUBLIC_DOWNLOAD_PATH, tag, message, t);
        writeLog(APP_PRIVATE_PATH, tag, message, t);
    }

    private static void writeLog(String path, String tag, String message, Throwable t) {
        try {
            File file = new File(path);
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            
            FileWriter fw = new FileWriter(file, true); // Append mode
            PrintWriter pw = new PrintWriter(fw);
            
            String timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(new Date());
            pw.println("[" + timestamp + "] [" + tag + "] " + message);
            
            if (t != null) {
                pw.println("[" + timestamp + "] [" + tag + "] Exception trace details:");
                t.printStackTrace(pw);
                pw.println();
            }
            
            pw.flush();
            pw.close();
            fw.close();
        } catch (Throwable e) {
            e.printStackTrace();
        }
    }
}
