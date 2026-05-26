package com.shieldlink.vpn;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "VpnPlugin")
public class VpnPlugin extends Plugin {

    @PluginMethod()
    public void startVpnConnection(PluginCall call) {
        String config = call.getString("config");
        if (config == null || config.isEmpty()) {
            call.reject("Missing required config JSON string.");
            return;
        }

        try {
            // Start the native VpnService background task
            Intent intent = new Intent(getContext(), MyVpnService.class);
            intent.putExtra("config", config);
            getContext().startService(intent);

            JSObject ret = new JSObject();
            ret.put("status", "CONNECTED");
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Failed to initiate native VPN: " + e.getMessage());
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
