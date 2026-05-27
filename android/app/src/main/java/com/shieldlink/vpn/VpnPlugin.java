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
        String config = call.getString("config");
        if (config == null || config.isEmpty()) {
            call.reject("Missing required config JSON string.");
            return;
        }
        latestConfig = config;

        try {
            Intent prepareIntent = VpnService.prepare(getContext());
            if (prepareIntent != null) {
                // Request system VPN permission pop-up dialog
                startActivityForResult(call, prepareIntent, "vpnPermissionResult");
            } else {
                // Already authorized, start the VPN directly
                executeStartVpn(call, config);
            }
        } catch (Exception e) {
            call.reject("Failed to prepare native VPN connection: " + e.getMessage());
        }
    }

    @ActivityCallback
    private void vpnPermissionResult(PluginCall call, ActivityResult result) {
        if (result.getResultCode() == android.app.Activity.RESULT_OK) {
            executeStartVpn(call, latestConfig);
        } else {
            if (call != null) {
                call.reject("User cancelled or rejected VPN connection permission request.");
            }
        }
    }

    private void executeStartVpn(PluginCall call, String config) {
        try {
            Intent intent = new Intent(getContext(), MyVpnService.class);
            intent.putExtra("config", config);

            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                getContext().startForegroundService(intent);
            } else {
                getContext().startService(intent);
            }

            JSObject ret = new JSObject();
            ret.put("status", "CONNECTED");
            if (call != null) {
                call.resolve(ret);
            }
        } catch (Exception e) {
            if (call != null) {
                call.reject("Failed to initiate native VPN background service: " + e.getMessage());
            }
        }
    }

    @PluginMethod()
    public void stopVpnConnection(PluginCall call) {
        try {
            // Stop the native VpnService background task
            Intent intent = new Intent(getContext(), MyVpnService.class);
            getContext().stopService(intent);

            JSObject ret = new JSObject();
            ret.put("status", "DISCONNECTED");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to stop native VPN: " + e.getMessage());
        }
    }
}

