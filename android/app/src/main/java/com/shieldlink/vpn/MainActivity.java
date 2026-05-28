package com.shieldlink.vpn;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        L.init(this);
        L.redirectNativeStdoutStderr(this);
        L.log("MainActivity", "onCreate called. Logger initialized early and native stdout/stderr redirected.");
        registerPlugin(VpnPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
