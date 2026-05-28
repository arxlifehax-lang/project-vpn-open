package com.shieldlink.vpn;

import java.io.File;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;
import java.util.LinkedList;
import android.util.Log;

public class L {
    private static final String PUBLIC_DOWNLOAD_PATH = "/storage/emulated/0/Download/vpn_debug_log.txt";
    private static final String APP_PRIVATE_PATH = "/storage/emulated/0/Android/data/com.shieldlink.vpn/files/vpn_debug_log.txt";
    
    // In-memory ring buffer for last 500 log entries (always available even without file I/O)
    private static final int MAX_BUFFER_SIZE = 500;
    private static final LinkedList<String> logBuffer = new LinkedList<>();

    public static synchronized void log(String tag, String message) {
        Log.d(tag, message);
        String formatted = formatLine(tag, message);
        addToBuffer(formatted);
        writeLog(PUBLIC_DOWNLOAD_PATH, formatted);
        writeLog(APP_PRIVATE_PATH, formatted);
    }

    public static synchronized void log(String tag, String message, Throwable t) {
        Log.e(tag, message, t);
        String formatted = formatLine(tag, message);
        addToBuffer(formatted);
        if (t != null) {
            StringWriter sw = new StringWriter();
            t.printStackTrace(new PrintWriter(sw));
            String trace = sw.toString();
            addToBuffer("[TRACE] " + trace.replace("\n", "\n[TRACE] "));
        }
        writeLog(PUBLIC_DOWNLOAD_PATH, formatted);
        writeLogWithTrace(APP_PRIVATE_PATH, formatted, t);
    }

    /** Returns all buffered log lines joined with newlines */
    public static synchronized String getBufferedLogs() {
        StringBuilder sb = new StringBuilder();
        for (String line : logBuffer) {
            sb.append(line).append("\n");
        }
        return sb.toString();
    }

    private static String formatLine(String tag, String message) {
        String timestamp = new SimpleDateFormat("yyyy-MM-dd HH:mm:ss.SSS", Locale.US).format(new Date());
        return "[" + timestamp + "] [" + tag + "] " + message;
    }

    private static void addToBuffer(String line) {
        logBuffer.addLast(line);
        while (logBuffer.size() > MAX_BUFFER_SIZE) {
            logBuffer.removeFirst();
        }
    }

    private static void writeLog(String path, String formatted) {
        try {
            File file = new File(path);
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            
            FileWriter fw = new FileWriter(file, true); // Append mode
            PrintWriter pw = new PrintWriter(fw);
            pw.println(formatted);
            pw.flush();
            pw.close();
            fw.close();
        } catch (Throwable e) {
            // Silently ignore file I/O errors - in-memory buffer is the primary source
        }
    }

    private static void writeLogWithTrace(String path, String formatted, Throwable t) {
        try {
            File file = new File(path);
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            
            FileWriter fw = new FileWriter(file, true);
            PrintWriter pw = new PrintWriter(fw);
            pw.println(formatted);
            if (t != null) {
                pw.println(formatted.substring(0, formatted.indexOf("]") + 1) + " Exception trace details:");
                t.printStackTrace(pw);
                pw.println();
            }
            pw.flush();
            pw.close();
            fw.close();
        } catch (Throwable e) {
            // Silently ignore
        }
    }
}
