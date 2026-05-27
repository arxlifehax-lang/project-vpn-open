package com.shieldlink.vpn;

import android.net.VpnService;
import android.content.Intent;
import android.os.ParcelFileDescriptor;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import android.content.pm.ServiceInfo;
import io.nekohasekai.libbox.*;

public class MyVpnService extends VpnService implements PlatformInterface, CommandServerHandler {
    private static CommandServer commandServer;
    private ParcelFileDescriptor vpnInterface;

    private void startForegroundServiceHelper() {
        String channelId = "shieldlink_vpn";
        String channelName = "ShieldLink VPN Service";
        
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                channelId,
                channelName,
                NotificationManager.IMPORTANCE_LOW
            );
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
        
        Notification notification = new NotificationCompat.Builder(this, channelId)
            .setContentTitle("ShieldLink VPN")
            .setContentText("Stealth secure tunnel is active...")
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setCategory(NotificationCompat.CATEGORY_SERVICE)
            .build();
            
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.UPSIDE_DOWN_CAKE) {
            startForeground(1, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_SYSTEM_EXEMPTED);
        } else {
            startForeground(1, notification);
        }
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        startForegroundServiceHelper();

        if (intent == null) return START_NOT_STICKY;
        
        String configJson = intent.getStringExtra("config");
        if (configJson == null) return START_NOT_STICKY;

        try {
            // Setup base directory path for sing-box core
            SetupOptions setupOptions = new SetupOptions();
            setupOptions.setWorkingPath(getFilesDir().getAbsolutePath());
            setupOptions.setBasePath(getFilesDir().getAbsolutePath());
            Libbox.setup(setupOptions);

            // Create command server with this class as handler and platform interface
            commandServer = new CommandServer(this, this);
            commandServer.start();
            commandServer.startOrReloadService(configJson, null);
        } catch (Exception e) {
            e.printStackTrace();
        }
        
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        try {
            if (commandServer != null) {
                commandServer.closeService();
                commandServer.close();
                commandServer = null;
            }
            if (vpnInterface != null) {
                vpnInterface.close();
                vpnInterface = null;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        super.onDestroy();
    }

    // PlatformInterface implementation
    @Override
    public int openTun(TunOptions options) throws Exception {
        Builder builder = new Builder();
        builder.setSession("ShieldLink")
               .setMtu(1280)
               .addAddress("172.19.0.1", 30)
               .addRoute("0.0.0.0", 0);
        vpnInterface = builder.establish();
        return vpnInterface.detachFd();
    }

    @Override
    public void autoDetectInterfaceControl(int fd) throws Exception {}

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
        return null;
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
        return null;
    }

    @Override
    public boolean underNetworkExtension() {
        return false;
    }

    @Override
    public boolean usePlatformAutoDetectInterfaceControl() {
        return false;
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
    public void serviceReload() throws Exception {}

    @Override
    public void serviceStop() throws Exception {
        stopSelf();
    }

    @Override
    public void setSystemProxyEnabled(boolean enabled) throws Exception {}

    @Override
    public void writeDebugMessage(String message) {}
}
