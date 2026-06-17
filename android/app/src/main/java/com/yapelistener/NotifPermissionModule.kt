package com.yapelistener

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.os.Build
import android.os.PowerManager
import android.provider.Settings
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

    @ReactMethod
    fun isBatteryOptimizationIgnored(promise: Promise) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val pm = reactContext.getSystemService(Context.POWER_SERVICE) as PowerManager
            promise.resolve(pm.isIgnoringBatteryOptimizations(reactContext.packageName))
        } else {
            promise.resolve(true)
        }
    }

    @ReactMethod
    fun requestIgnoreBatteryOptimization() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            val intent = Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS).apply {
                data = Uri.parse("package:${reactContext.packageName}")
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactContext.startActivity(intent)
        }
    }

    @ReactMethod
    fun getConfig(promise: Promise) {
        val prefs = reactContext.getSharedPreferences("factufly_config", Context.MODE_PRIVATE)
        val map = com.facebook.react.bridge.Arguments.createMap()
        map.putString("empresaRuc", prefs.getString("empresaRuc", "") ?: "")
        map.putString("sucursalId", prefs.getString("sucursalId", "") ?: "")
        promise.resolve(map)
    }
}
