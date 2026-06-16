package com.yapelistener

import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationManagerCompat
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class NotifPermissionModule(private val reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    override fun getName() = "NotifPermission"

    @ReactMethod
    fun isGranted(promise: Promise) {
        val enabled = NotificationManagerCompat.getEnabledListenerPackages(reactContext)
        promise.resolve(enabled.contains(reactContext.packageName))
    }

    @ReactMethod
    fun openSettings() {
        val intent = Intent("android.settings.ACTION_NOTIFICATION_LISTENER_SETTINGS")
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        reactContext.startActivity(intent)
    }

    @ReactMethod
    fun saveConfig(empresaRuc: String, sucursalId: String) {
        val prefs = reactContext.getSharedPreferences("factufly_config", Context.MODE_PRIVATE)
        prefs.edit()
            .putString("empresaRuc", empresaRuc)
            .putString("sucursalId", sucursalId)
            .apply()
    }
}
