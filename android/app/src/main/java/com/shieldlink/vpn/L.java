package com.shieldlink.vpn;

import android.content.Context;
import java.io.BufferedReader;
import java.io.File;
import java.io.FileReader;
import java.io.FileWriter;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.text.SimpleDateFormat;
import java.util.ArrayList;
import java.util.Date;
import java.util.LinkedList;
import java.util.List;
import java.util.Locale;
import android.util.Log;

public class L {
    // External paths (may fail without storage permission)
    private static final String PUBLIC_DOWNLOAD_PATH = "/storage/emulated/0/Download/vpn_debug_log.txt";
    private static final String APP_PRIVATE_PATH = "/storage/emulated/0/Android/data/com.shieldlink.vpn/files/vpn_debug_log.txt";
    
    // Internal storage path (ALWAYS works, no permission needed, survives crash)
    private static String internalLogPath = null;
    
    // In-memory ring buffer for current session (lost on crash)
    private static final int MAX_BUFFER_SIZE = 500;
    private static final LinkedList<String> logBuffer = new LinkedList<>();
    
    // Max log file size before rotation (500KB)
    private static final long MAX_LOG_FILE_SIZE = 500 * 1024;

    /**
     * MUST be called once with a Context to enable internal storage logging.
     * Call this early (e.g., from MyVpnService.onStartCommand or Application.onCreate).
     */
    public static synchronized void init(Context context) {
        if (internalLogPath != null) return; // already initialized
        try {
            File filesDir = context.getFilesDir();
            if (filesDir != null) {
                internalLogPath = new File(filesDir, "vpn_debug_log.txt").getAbsolutePath();
                Log.d("L", "Internal log path set: " + internalLogPath);
            }
        } catch (Throwable e) {
            Log.e("L", "Failed to init internal log path", e);
        }
    }

    /**
     * Redirects native stdout (fd 1) and stderr (fd 2) to the log file.
     * Captures native Go core panics, SIGABRT, and JNI library crashes.
     */
    public static synchronized void redirectNativeStdoutStderr(Context context) {
        if (internalLogPath == null) {
            init(context);
        }
        if (internalLogPath == null) return;
        try {
            File logFile = new File(internalLogPath);
            if (!logFile.exists()) {
                logFile.createNewFile();
            }
            // Open in append mode
            java.io.FileOutputStream fos = new java.io.FileOutputStream(logFile, true);
            java.io.FileDescriptor fd = fos.getFD();
            
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.LOLLIPOP) {
                android.system.Os.dup2(fd, 1);
                android.system.Os.dup2(fd, 2);
                Log.d("L", "Successfully redirected native stdout and stderr to " + internalLogPath);
            }
        } catch (Throwable e) {
            Log.e("L", "Failed to redirect native stdout/stderr", e);
        }
    }

    public static synchronized void log(String tag, String message) {
        Log.d(tag, message);
        String formatted = formatLine(tag, message);
        addToBuffer(formatted);
        // Write to ALL destinations - internal first (most reliable)
        if (internalLogPath != null) writeLog(internalLogPath, formatted);
        writeLog(PUBLIC_DOWNLOAD_PATH, formatted);
        writeLog(APP_PRIVATE_PATH, formatted);
    }

    public static synchronized void log(String tag, String message, Throwable t) {
        Log.e(tag, message, t);
        String formatted = formatLine(tag, message);
        addToBuffer(formatted);
        
        String traceFormatted = null;
        if (t != null) {
            StringWriter sw = new StringWriter();
            t.printStackTrace(new PrintWriter(sw));
            String trace = sw.toString();
            traceFormatted = "[TRACE] " + trace.replace("\n", "\n[TRACE] ");
            addToBuffer(traceFormatted);
        }
        
        // Write to ALL destinations - internal first (most reliable)
        if (internalLogPath != null) writeLogWithTrace(internalLogPath, formatted, t);
        writeLog(PUBLIC_DOWNLOAD_PATH, formatted);
        writeLogWithTrace(APP_PRIVATE_PATH, formatted, t);
    }

    public static synchronized String getBufferedLogs() {
        StringBuilder sb = new StringBuilder();
        sb.append("=== SYSTEM DIAGNOSTICS ===\n");
        sb.append("Internal Log Path: ").append(internalLogPath != null ? internalLogPath : "NULL").append("\n");
        
        if (internalLogPath != null) {
            try {
                File file = new File(internalLogPath);
                sb.append("Log File Exists: ").append(file.exists()).append("\n");
                if (file.exists()) {
                    sb.append("Log File Size: ").append(file.length()).append(" bytes\n");
                }
            } catch (Throwable e) {
                sb.append("Log File Check Error: ").append(e.getMessage()).append("\n");
            }
        }
        
        // Try reading from file first, because it contains both historical logs (including crashes) and current logs
        String fileLogs = readLogsFromFile();
        if (fileLogs != null && !fileLogs.trim().isEmpty()) {
            sb.append("\n=== RECOVERED LOGS FROM FILE ===\n");
            sb.append(fileLogs);
            return sb.toString();
        }
        
        // Fallback to in-memory buffer if file is empty/unavailable
        if (!logBuffer.isEmpty()) {
            sb.append("\n=== IN-MEMORY LOGS (Fallback) ===\n");
            for (String line : logBuffer) {
                sb.append(line).append("\n");
            }
            return sb.toString();
        }
        
        sb.append("\nNo logs available.");
        return sb.toString();
    }

    /**
     * Read the last 300 lines from the most reliable log file.
     * Tries internal storage first, then external paths.
     */
    public static String readLogsFromFile() {
        // Try internal storage first (always works)
        if (internalLogPath != null) {
            String logs = readLastLines(internalLogPath, 300);
            if (logs != null) return logs;
        }
        // Try app-private external
        String logs = readLastLines(APP_PRIVATE_PATH, 300);
        if (logs != null) return logs;
        // Try public download
        return readLastLines(PUBLIC_DOWNLOAD_PATH, 300);
    }

    private static String readLastLines(String path, int maxLines) {
        try {
            File file = new File(path);
            if (!file.exists() || file.length() == 0) return null;
            
            BufferedReader br = new BufferedReader(new FileReader(file));
            List<String> lines = new ArrayList<>();
            String line;
            while ((line = br.readLine()) != null) {
                lines.add(line);
            }
            br.close();
            
            if (lines.isEmpty()) return null;
            
            int startIdx = Math.max(0, lines.size() - maxLines);
            StringBuilder sb = new StringBuilder();
            for (int i = startIdx; i < lines.size(); i++) {
                sb.append(lines.get(i)).append("\n");
            }
            return sb.toString();
        } catch (Throwable e) {
            return null;
        }
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
            
            // Rotate if too large
            rotateIfNeeded(file);
            
            FileWriter fw = new FileWriter(file, true); // Append mode
            PrintWriter pw = new PrintWriter(fw);
            pw.println(formatted);
            pw.flush();
            pw.close();
            fw.close();
        } catch (Throwable e) {
            // Silently ignore
        }
    }

    private static void writeLogWithTrace(String path, String formatted, Throwable t) {
        try {
            File file = new File(path);
            File parent = file.getParentFile();
            if (parent != null && !parent.exists()) {
                parent.mkdirs();
            }
            
            rotateIfNeeded(file);
            
            FileWriter fw = new FileWriter(file, true);
            PrintWriter pw = new PrintWriter(fw);
            pw.println(formatted);
            if (t != null) {
                pw.println("  >>> Exception: " + t.getClass().getName() + ": " + t.getMessage());
                StringWriter sw = new StringWriter();
                t.printStackTrace(new PrintWriter(sw));
                pw.println(sw.toString());
            }
            pw.flush();
            pw.close();
            fw.close();
        } catch (Throwable e) {
            // Silently ignore
        }
    }

    /** Rotate log file if it exceeds MAX_LOG_FILE_SIZE */
    private static void rotateIfNeeded(File file) {
        try {
            if (file.exists() && file.length() > MAX_LOG_FILE_SIZE) {
                // Keep only the last half of the file
                BufferedReader br = new BufferedReader(new FileReader(file));
                List<String> lines = new ArrayList<>();
                String line;
                while ((line = br.readLine()) != null) {
                    lines.add(line);
                }
                br.close();
                
                // Keep last 60% of lines
                int keepFrom = (int)(lines.size() * 0.4);
                FileWriter fw = new FileWriter(file, false); // overwrite
                PrintWriter pw = new PrintWriter(fw);
                pw.println("=== LOG ROTATED at " + new SimpleDateFormat("yyyy-MM-dd HH:mm:ss", Locale.US).format(new Date()) + " ===");
                for (int i = keepFrom; i < lines.size(); i++) {
                    pw.println(lines.get(i));
                }
                pw.flush();
                pw.close();
                fw.close();
            }
        } catch (Throwable e) {
            // Ignore rotation errors
        }
    }
}
