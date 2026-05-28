package com.shieldlink.vpn;

import android.net.VpnService;
import android.content.Intent;
import android.content.SharedPreferences;
import android.os.ParcelFileDescriptor;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.content.pm.ServiceInfo;
import io.nekohasekai.libbox.*;

public class MyVpnService extends VpnService implements PlatformInterface, CommandServerHandler {
    private static boolean isLibboxInitialized = false;
    private static CommandServer commandServer;
    private ParcelFileDescriptor vpnInterface;
    private int vpnInterfaceFd = -1;
    private volatile boolean isRunning = false;
    
    private static final String PREFS_NAME = "shieldlink_vpn_prefs";
    private static final String PREF_KEY_CONFIG = "last_vpn_config";

    /** Save config to SharedPreferences so it survives service restart */
    private void saveConfig(String configJson) {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().putString(PREF_KEY_CONFIG, configJson).apply();
            L.log("MyVpnService", "Config saved to SharedPreferences (length=" + configJson.length() + ")");
        } catch (Throwable e) {
            L.log("MyVpnService", "Failed to save config to SharedPreferences", e);
        }
    }

    /** Load config from SharedPreferences (for recovery after crash-restart) */
    private String loadSavedConfig() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            String config = prefs.getString(PREF_KEY_CONFIG, null);
            if (config != null && !config.isEmpty()) {
                L.log("MyVpnService", "Recovered config from SharedPreferences (length=" + config.length() + ")");
                return config;
            }
        } catch (Throwable e) {
            L.log("MyVpnService", "Failed to load config from SharedPreferences", e);
        }
        return null;
    }

    /** Clear saved config (on intentional disconnect) */
    private void clearSavedConfig() {
        try {
            SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
            prefs.edit().remove(PREF_KEY_CONFIG).apply();
        } catch (Throwable ignored) {}
    }

    private void startForegroundServiceHelper() {
        L.log("MyVpnService", "startForegroundServiceHelper called.");
        try {
            String channelId = "shieldlink_vpn";
            String channelName = "ShieldLink VPN Service";
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                L.log("MyVpnService", "Android >= 8.0. Creating Notification Channel...");
                NotificationChannel channel = new NotificationChannel(
                    channelId,
                    channelName,
                    NotificationManager.IMPORTANCE_LOW
                );
                NotificationManager manager = getSystemService(NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                    L.log("MyVpnService", "Notification Channel created successfully.");
                }
            }
            
            L.log("MyVpnService", "Building Notification...");
            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, channelId);
            } else {
                builder = new Notification.Builder(this);
            }
            
            Notification notification = builder
                .setContentTitle("ShieldLink VPN")
                .setContentText("Stealth secure tunnel is active...")
                .setSmallIcon(android.R.drawable.ic_dialog_info)
                .setOngoing(true)
                .build();
                
            L.log("MyVpnService", "Calling startForeground...");
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
                L.log("MyVpnService", "Android >= 14. Passing FOREGROUND_SERVICE_TYPE_SPECIAL_USE...");
                startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(1, notification);
            }
            L.log("MyVpnService", "startForeground completed.");
        } catch (Throwable e) {
            L.log("MyVpnService", "Exception in startForegroundServiceHelper", e);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        // Initialize crash-proof file logger FIRST (before any logging)
        L.init(this);
        L.redirectNativeStdoutStderr(this);
        L.log("MyVpnService", "onStartCommand invoked. startId = " + startId + ", flags = " + flags);
        startForegroundServiceHelper();

        // Resolve config: from intent, or recovered from SharedPreferences
        String configJson = null;
        String configSource = "unknown";

        if (intent != null) {
            configJson = intent.getStringExtra("config");
            if (configJson != null && !configJson.isEmpty()) {
                configSource = "intent";
                L.log("MyVpnService", "Config received from intent (length=" + configJson.length() + ")");
                // Save for crash-recovery
                saveConfig(configJson);
            }
        }
        
        // If intent was null or had no config, try to recover from SharedPreferences
        if (configJson == null || configJson.isEmpty()) {
            L.log("MyVpnService", "No config in intent. Attempting recovery from SharedPreferences...");
            configJson = loadSavedConfig();
            if (configJson != null) {
                configSource = "recovered-from-prefs";
            }
        }

        // If still no config available, stop the zombie service
        if (configJson == null || configJson.isEmpty()) {
            L.log("MyVpnService", "No config available from any source. Stopping zombie service.");
            stopSelf();
            return START_NOT_STICKY;
        }

        L.log("MyVpnService", "Using config source: " + configSource + ", length = " + configJson.length());

        // Prevent duplicate starts
        if (isRunning && commandServer != null) {
            L.log("MyVpnService", "Service is already running. Reloading config...");
            try {
                commandServer.startOrReloadService(configJson, new OverrideOptions());
                L.log("MyVpnService", "Config reloaded successfully.");
            } catch (Throwable e) {
                L.log("MyVpnService", "Throwable caught during config reload", e);
            }
            return START_STICKY;
        }

        // Start fresh
        final String finalConfigJson = configJson;
        final String finalConfigSource = configSource;
        Thread vpnThread = new Thread(() -> {
            try {
                if (!isLibboxInitialized) {
                    L.log("MyVpnService", "Setting up SetupOptions for Libbox...");
                    SetupOptions setupOptions = new SetupOptions();
                    String basePath = getFilesDir().getAbsolutePath();
                    setupOptions.setWorkingPath(basePath);
                    setupOptions.setBasePath(basePath);
                    
                    L.log("MyVpnService", "Invoking Libbox.setup with basePath = " + basePath);
                    Libbox.setup(setupOptions);
                    isLibboxInitialized = true;
                    L.log("MyVpnService", "Libbox.setup completed successfully.");
                } else {
                    L.log("MyVpnService", "Libbox is already setup. Skipping setup.");
                }

                if (commandServer != null) {
                    L.log("MyVpnService", "Existing CommandServer instance found in background. Closing it first...");
                    try { commandServer.closeService(); } catch (Throwable ignored) {}
                    try { commandServer.close(); } catch (Throwable ignored) {}
                    commandServer = null;
                }

                L.log("MyVpnService", "Creating CommandServer instance...");
                commandServer = new CommandServer(MyVpnService.this, MyVpnService.this);
                
                L.log("MyVpnService", "Starting CommandServer...");
                try {
                    commandServer.start();
                    L.log("MyVpnService", "CommandServer started successfully.");
                } catch (Throwable startErr) {
                    L.log("MyVpnService", "CommandServer.start() failed", startErr);
                    cleanupService();
                    stopSelf();
                    return;
                }

                L.log("MyVpnService", "Loading sing-box config into CommandServer (source=" + finalConfigSource + ")...");
                try {
                    commandServer.startOrReloadService(finalConfigJson, new OverrideOptions());
                    isRunning = true;
                    L.log("MyVpnService", "CommandServer service started and running successfully!");
                } catch (Throwable configErr) {
                    L.log("MyVpnService", "startOrReloadService failed (bad config or Go core panic)", configErr);
                    // Clear the bad config so we don't keep crashing on recovery
                    clearSavedConfig();
                    cleanupService();
                    stopSelf();
                    return;
                }
            } catch (Throwable e) {
                L.log("MyVpnService", "Throwable caught in onStartCommand background thread", e);
                cleanupService();
                stopSelf();
            }
        }, "VpnServiceInit");
        
        // Install crash handler so Go core panics don't kill the app
        vpnThread.setUncaughtExceptionHandler((thread, ex) -> {
            L.log("MyVpnService", "FATAL: Uncaught exception in VPN thread '" + thread.getName() + "'", ex);
            cleanupService();
            try { stopSelf(); } catch (Throwable ignored) {}
        });
        
        vpnThread.start();
        
        return START_STICKY;
    }

    private void cleanupService() {
        L.log("MyVpnService", "cleanupService called.");
        try {
            if (commandServer != null) {
                try { commandServer.closeService(); } catch (Throwable ignored) {}
                try { commandServer.close(); } catch (Throwable ignored) {}
                commandServer = null;
            }
            if (vpnInterface != null) {
                try { vpnInterface.close(); } catch (Throwable ignored) {}
                vpnInterface = null;
            }
            if (vpnInterfaceFd != -1) {
                L.log("MyVpnService", "Explicitly closing vpnInterfaceFd: " + vpnInterfaceFd);
                try {
                    ParcelFileDescriptor.adoptFd(vpnInterfaceFd).close();
                } catch (Throwable e) {
                    L.log("MyVpnService", "Failed to close vpnInterfaceFd", e);
                }
                vpnInterfaceFd = -1;
            }
        } catch (Throwable e) {
            L.log("MyVpnService", "Exception in cleanupService", e);
        }
        isRunning = false;
    }

    @Override
    public void onDestroy() {
        L.log("MyVpnService", "onDestroy invoked.");
        clearSavedConfig();
        cleanupService();
        L.log("MyVpnService", "Clean up completed.");
        super.onDestroy();
    }

    @Override
    public void onRevoke() {
        L.log("MyVpnService", "onRevoke invoked (VPN permission revoked by user/system).");
        cleanupService();
        stopSelf();
        super.onRevoke();
    }

    // PlatformInterface implementation
    @Override
    public int openTun(TunOptions options) throws Exception {
        L.log("MyVpnService", "openTun JNI Callback triggered by Go core!");
        try {
            L.log("MyVpnService", "Creating VpnService.Builder...");
            Builder builder = new Builder();
            builder.setSession("ShieldLink");

            // MTU from options or default 9000
            int mtu = 9000;
            try {
                int optionsMtu = options.getMTU();
                if (optionsMtu > 0) mtu = optionsMtu;
            } catch (Throwable e) {
                L.log("MyVpnService", "Failed to get MTU from options, using default", e);
            }
            builder.setMtu(mtu);
            L.log("MyVpnService", "MTU set to: " + mtu);

            // Add IPv4 addresses from TunOptions (returns RoutePrefixIterator)
            boolean hasAddress = false;
            L.log("MyVpnService", "Processing inet4 addresses...");
            try {
                RoutePrefixIterator inet4Iter = options.getInet4Address();
                if (inet4Iter != null) {
                    while (inet4Iter.hasNext()) {
                        RoutePrefix addr = inet4Iter.next();
                        String address = addr.address();
                        int prefix = addr.prefix();
                        L.log("MyVpnService", "Adding inet4 address: " + address + "/" + prefix);
                        builder.addAddress(address, prefix);
                        hasAddress = true;
                    }
                }
            } catch (Throwable e) {
                L.log("MyVpnService", "Error reading inet4 addresses from options", e);
            }

            // Add IPv6 addresses from TunOptions (returns RoutePrefixIterator)
            L.log("MyVpnService", "Processing inet6 addresses...");
            boolean hasV6Address = false;
            try {
                RoutePrefixIterator inet6Iter = options.getInet6Address();
                if (inet6Iter != null) {
                    while (inet6Iter.hasNext()) {
                        RoutePrefix addr = inet6Iter.next();
                        String address = addr.address();
                        int prefix = addr.prefix();
                        L.log("MyVpnService", "Adding inet6 address: " + address + "/" + prefix);
                        builder.addAddress(address, prefix);
                        hasAddress = true;
                        hasV6Address = true;
                    }
                }
            } catch (Throwable e) {
                L.log("MyVpnService", "Error reading inet6 addresses from options", e);
            }

            // Fallback if no addresses were obtained from options
            if (!hasAddress) {
                L.log("MyVpnService", "No addresses from options, using fallback 172.19.0.1/30");
                builder.addAddress("172.19.0.1", 30);
            }

            // Add default routes
            L.log("MyVpnService", "Adding default routes...");
            try {
                builder.addRoute("0.0.0.0", 0);
                L.log("MyVpnService", "Default IPv4 route added successfully.");
            } catch (Throwable e) {
                L.log("MyVpnService", "Failed to add default IPv4 route", e);
            }

            if (hasV6Address) {
                try {
                    builder.addRoute("::", 0);
                    L.log("MyVpnService", "Default IPv6 route added successfully.");
                } catch (Throwable e) {
                    L.log("MyVpnService", "Failed to add default IPv6 route", e);
                }
            } else {
                L.log("MyVpnService", "Skipping default IPv6 route because no IPv6 address was configured.");
            }

            // Add DNS servers
            L.log("MyVpnService", "Adding DNS servers...");
            builder.addDnsServer("1.1.1.1");
            builder.addDnsServer("8.8.8.8");

            // Exclude our own app from VPN to prevent routing loops
            try {
                builder.addDisallowedApplication(getPackageName());
                L.log("MyVpnService", "Excluded own package: " + getPackageName());
            } catch (Throwable e) {
                L.log("MyVpnService", "Failed to exclude own package", e);
            }

            L.log("MyVpnService", "Calling builder.establish()...");
            vpnInterface = builder.establish();
            if (vpnInterface == null) {
                L.log("MyVpnService", "builder.establish() returned NULL!");
                throw new NullPointerException("VpnService builder.establish() returned null. VPN permission may have been revoked.");
            }
            
            int fd = vpnInterface.detachFd();
            vpnInterfaceFd = fd;
            L.log("MyVpnService", "VPN established successfully! FD = " + fd);
            return fd;
        } catch (Throwable e) {
            L.log("MyVpnService", "Throwable caught in openTun", e);
            throw new Exception("openTun failed: " + e.getMessage(), e);
        }
    }

    @Override
    public void autoDetectInterfaceControl(int fd) throws Exception {
        L.log("MyVpnService", "autoDetectInterfaceControl called. FD = " + fd);
        // CRITICAL: Protect this socket from being routed through the VPN tunnel
        // This prevents routing loops. Exactly matches official SFA implementation.
        boolean success = protect(fd);
        L.log("MyVpnService", "protect(fd=" + fd + ") result = " + success);
        if (!success) {
            throw new Exception("Failed to protect socket fd=" + fd);
        }
    }

    @Override
    public void clearDNSCache() {}

    @Override
    public void closeDefaultInterfaceMonitor(InterfaceUpdateListener listener) throws Exception {}

    @Override
    public ConnectionOwner findConnectionOwner(int ipVersion, String srcIp, int srcPort, String destIp, int destPort) throws Exception {
        return new ConnectionOwner();
    }

    @Override
    public NetworkInterfaceIterator getInterfaces() throws Exception {
        return new NetworkInterfaceIterator() {
            @Override
            public boolean hasNext() {
                return false;
            }
            @Override
            public NetworkInterface next() {
                return null;
            }
        };
    }

    @Override
    public boolean includeAllNetworks() {
        return true;
    }

    @Override
    public LocalDNSTransport localDNSTransport() {
        return null;
    }

    @Override
    public WIFIState readWIFIState() {
        return null;
    }

    @Override
    public void sendNotification(io.nekohasekai.libbox.Notification notification) throws Exception {}

    @Override
    public void startDefaultInterfaceMonitor(InterfaceUpdateListener listener) throws Exception {}

    @Override
    public StringIterator systemCertificates() {
        return new StringIterator() {
            @Override
            public boolean hasNext() {
                return false;
            }
            @Override
            public String next() {
                return null;
            }
            @Override
            public int len() {
                return 0;
            }
        };
    }

    @Override
    public boolean underNetworkExtension() {
        return false;
    }

    @Override
    public boolean usePlatformAutoDetectInterfaceControl() {
        // MUST return true so sing-box calls autoDetectInterfaceControl()
        // to protect outgoing sockets from routing loops.
        // Matches official SFA: usePlatformAutoDetectInterfaceControl() = true
        return true;
    }

    @Override
    public boolean useProcFS() {
        return false;
    }

    // CommandServerHandler implementation
    @Override
    public SystemProxyStatus getSystemProxyStatus() throws Exception {
        return null;
    }

    @Override
    public void serviceReload() throws Exception {
        L.log("MyVpnService", "serviceReload called.");
    }

    @Override
    public void serviceStop() throws Exception {
        L.log("MyVpnService", "serviceStop called from Go core.");
        cleanupService();
        stopSelf();
    }

    @Override
    public void setSystemProxyEnabled(boolean enabled) throws Exception {}

    @Override
    public void writeDebugMessage(String message) {
        L.log("MyVpnService-GoCore", message);
    }
}
