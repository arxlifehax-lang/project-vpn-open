package com.shieldlink.vpn;

import android.net.VpnService;
import android.content.Intent;
import android.os.ParcelFileDescriptor;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import android.content.pm.ServiceInfo;
import io.nekohasekai.libbox.*;

public class MyVpnService extends VpnService implements PlatformInterface, CommandServerHandler {
    private static CommandServer commandServer;
    private ParcelFileDescriptor vpnInterface;
    private volatile boolean isRunning = false;

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
        L.log("MyVpnService", "onStartCommand invoked. startId = " + startId);
        startForegroundServiceHelper();

        if (intent == null) {
            L.log("MyVpnService", "onStartCommand received null intent.");
            return START_NOT_STICKY;
        }
        
        String configJson = intent.getStringExtra("config");
        if (configJson == null) {
            L.log("MyVpnService", "onStartCommand: config extra is null.");
            return START_NOT_STICKY;
        }
        L.log("MyVpnService", "Received config length = " + configJson.length());

        // Prevent duplicate starts
        if (isRunning && commandServer != null) {
            L.log("MyVpnService", "Service is already running. Reloading config...");
            try {
                commandServer.startOrReloadService(configJson, null);
                L.log("MyVpnService", "Config reloaded successfully.");
            } catch (Throwable e) {
                L.log("MyVpnService", "Throwable caught during config reload", e);
            }
            return START_STICKY;
        }

        // Start fresh
        new Thread(() -> {
            try {
                L.log("MyVpnService", "Setting up SetupOptions for Libbox...");
                SetupOptions setupOptions = new SetupOptions();
                String basePath = getFilesDir().getAbsolutePath();
                setupOptions.setWorkingPath(basePath);
                setupOptions.setBasePath(basePath);
                
                L.log("MyVpnService", "Invoking Libbox.setup with basePath = " + basePath);
                Libbox.setup(setupOptions);
                L.log("MyVpnService", "Libbox.setup completed successfully.");

                L.log("MyVpnService", "Creating CommandServer instance...");
                commandServer = new CommandServer(MyVpnService.this, MyVpnService.this);
                L.log("MyVpnService", "Starting CommandServer...");
                commandServer.start();
                L.log("MyVpnService", "CommandServer started. Loading configuration...");
                commandServer.startOrReloadService(configJson, null);
                isRunning = true;
                L.log("MyVpnService", "CommandServer service started and running.");
            } catch (Throwable e) {
                L.log("MyVpnService", "Throwable caught in onStartCommand background thread", e);
                cleanupService();
            }
        }, "VpnServiceInit").start();
        
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
        } catch (Throwable e) {
            L.log("MyVpnService", "Exception in cleanupService", e);
        }
        isRunning = false;
    }

    @Override
    public void onDestroy() {
        L.log("MyVpnService", "onDestroy invoked.");
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
            L.log("MyVpnService", "Adding default routes (0.0.0.0/0 and ::/0)...");
            builder.addRoute("0.0.0.0", 0);
            builder.addRoute("::", 0);

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
        return null;
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
