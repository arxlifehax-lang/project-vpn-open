package com.shieldlink.vpn;

import android.content.Intent;
import android.net.VpnService;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.ActivityCallback;
import androidx.activity.result.ActivityResult;

@CapacitorPlugin(name = "VpnPlugin")
public class VpnPlugin extends Plugin {

    private String latestConfig = "";

    @PluginMethod()
    public void startVpnConnection(PluginCall call) {
        L.log("VpnPlugin", "startVpnConnection invoked.");
        String config = call.getString("config");
        if (config == null || config.isEmpty()) {
            L.log("VpnPlugin", "Rejecting: Missing required config JSON string.");
            call.reject("Missing required config JSON string.");
            return;
        }
        latestConfig = config;
        L.log("VpnPlugin", "Config successfully set. Length = " + config.length());

        try {
            L.log("VpnPlugin", "Preparing system VpnService...");
            Intent prepareIntent = VpnService.prepare(getContext());
            if (prepareIntent != null) {
                L.log("VpnPlugin", "prepareIntent is NOT null. Triggering system permission dialog...");
                startActivityForResult(call, prepareIntent, "vpnPermissionResult");
            } else {
                L.log("VpnPlugin", "prepareIntent is null (Already authorized). Direct launch executing...");
                executeStartVpn(call, config);
            }
        } catch (Throwable e) {
            L.log("VpnPlugin", "Exception caught during startVpnConnection", e);
            call.reject("Failed to prepare native VPN connection: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void vpnPermissionResult(PluginCall call, ActivityResult result) {
        L.log("VpnPlugin", "vpnPermissionResult callback received. ResultCode = " + result.getResultCode());
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            L.log("VpnPlugin", "Permission request approved by user. Executing launch...");
            executeStartVpn(call, latestConfig);
        } else {
            L.log("VpnPlugin", "Permission request denied or cancelled by user. ResultCode = " + result.getResultCode());
            if (call != null) {
                call.reject("User cancelled or rejected VPN connection permission request.");
            }
        }
    }

    private void executeStartVpn(PluginCall call, String config) {
        L.log("VpnPlugin", "executeStartVpn called.");
        try {
            L.log("VpnPlugin", "Building service intent for MyVpnService...");
            Intent intent = new Intent(getContext(), MyVpnService.class);
            intent.putExtra("config", config);

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                L.log("VpnPlugin", "API level is O or newer (API >= 26). Invoking startForegroundService...");
                getContext().startForegroundService(intent);
            } else {
                L.log("VpnPlugin", "API level is older than O (API < 26). Invoking startService...");
                getContext().startService(intent);
            }
            L.log("VpnPlugin", "Service launch completed successfully.");

            JSObject ret = new JSObject();
            ret.put("status", "CONNECTED");
            if (call != null) {
                L.log("VpnPlugin", "Resolving PluginCall with CONNECTED status.");
                call.resolve(ret);
            }
        } catch (Throwable e) {
            L.log("VpnPlugin", "Exception caught in executeStartVpn", e);
            if (call != null) {
                call.reject("Failed to initiate native VPN background service: " + e.getMessage());
            }
        }
    }

    @PluginMethod()
    public void stopVpnConnection(PluginCall call) {
        L.log("VpnPlugin", "stopVpnConnection invoked.");
        try {
            Intent intent = new Intent(getContext(), MyVpnService.class);
            L.log("VpnPlugin", "Stopping MyVpnService...");
            getContext().stopService(intent);
            L.log("VpnPlugin", "Service stopped successfully.");

            JSObject ret = new JSObject();
            ret.put("status", "DISCONNECTED");
            call.resolve(ret);
        } catch (Throwable e) {
            L.log("VpnPlugin", "Exception caught in stopVpnConnection", e);
            call.reject("Failed to stop native VPN: " + e.getMessage());
        }
    }
}

