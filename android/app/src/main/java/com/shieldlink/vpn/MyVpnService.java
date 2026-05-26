package com.shieldlink.vpn;

import android.net.VpnService;
import android.content.Intent;
import android.os.ParcelFileDescriptor;
import io.nekohasekai.libbox.*;

public class MyVpnService extends VpnService implements PlatformInterface, CommandServerHandler {
    private static CommandServer commandServer;
    private ParcelFileDescriptor vpnInterface;

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
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
    public void sendNotification(Notification notification) throws Exception {}

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
