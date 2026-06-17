package com.yapelistener

import android.app.Notification
import android.content.Context
import android.os.PowerManager
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import java.net.URL
import javax.net.ssl.HttpsURLConnection

class YapeNotificationService : NotificationListenerService() {

    companion object {
        private const val YAPE_PACKAGE = "com.bcp.innovacxion.yapeapp"
        private const val BACKEND_URL = "https://do.velsat.pe:8443/notify/yape"
        private const val PREFS_NAME = "factufly_config"
    }

    data class YapePago(val monto: Double, val remitente: String, val codigoSeguridad: String)

    override fun onListenerConnected() {
        super.onListenerConnected()
        Log.d("YapeListener", "Servicio conectado ✓")
    }

    override fun onNotificationPosted(sbn: StatusBarNotification?) {
        val pkg = sbn?.packageName ?: return
        Log.d("YapeListener", "Notificación recibida de: $pkg")

        if (pkg != YAPE_PACKAGE) return

        val extras = sbn.notification.extras
        val title = extras.getString(Notification.EXTRA_TITLE) ?: ""
        val body = extras.getString(Notification.EXTRA_TEXT)
            ?: extras.getString(Notification.EXTRA_BIG_TEXT)
            ?: return

        Log.d("YapeListener", "Yape detectado | title: $title | body: $body")

        val parsed = parseYape(body)
        if (parsed == null) {
            Log.d("YapeListener", "No se pudo parsear: $body")
            return
        }

        Log.d("YapeListener", "Parseado: monto=${parsed.monto} remitente=${parsed.remitente} codigo=${parsed.codigoSeguridad}")
        postToBackend(title, body, parsed)
    }

    private fun parseYape(body: String): YapePago? {
        val montoMatch = Regex("S/[.\\s]*(\\d+[.,]?\\d*)").find(body) ?: return null
        val monto = montoMatch.groupValues[1].replace(",", ".").toDoubleOrNull() ?: return null

        val remitenteMatch = Regex("^(.+?)\\s+te (envió|ha enviado)").find(body)
        val remitente = remitenteMatch?.groupValues?.get(1)?.trim() ?: "Yape"

        val codigoMatch = Regex("cód\\.?\\s+de seguridad\\s*(?:es:?)?\\s*(\\d+)", RegexOption.IGNORE_CASE).find(body)
        val codigo = codigoMatch?.groupValues?.get(1) ?: ""

        return YapePago(monto, remitente, codigo)
    }

    private fun getConfig(): Pair<String, String> {
        val prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val ruc = prefs.getString("empresaRuc", "") ?: ""
        val sucursalId = prefs.getString("sucursalId", "") ?: ""
        return Pair(ruc, sucursalId)
    }

    private fun postToBackend(title: String, body: String, pago: YapePago) {
        val (empresaRuc, sucursalId) = getConfig()

        // WakeLock: mantiene el CPU activo aunque la pantalla esté apagada (Doze mode)
        val pm = getSystemService(Context.POWER_SERVICE) as PowerManager
        val wakeLock = pm.newWakeLock(
            PowerManager.PARTIAL_WAKE_LOCK,
            "FactuFlyAlertas::YapePost"
        )
        wakeLock.acquire(15_000L) // máximo 15 seg, se libera antes al terminar

        Thread {
            try {
                val url = URL(BACKEND_URL)
                val conn = url.openConnection() as HttpsURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.connectTimeout = 10000
                conn.readTimeout = 10000
                conn.doOutput = true

                fun esc(s: String) = s.replace("\\", "\\\\").replace("\"", "\\\"")
                val fechaHora = java.time.Instant.now().toString()
                val json = """{"title":"${esc(title)}","body":"${esc(body)}","monto":${pago.monto},"remitente":"${esc(pago.remitente)}","codigoSeguridad":"${pago.codigoSeguridad}","empresaRuc":"${esc(empresaRuc)}","sucursalId":"${esc(sucursalId)}","fechaHora":"$fechaHora"}"""

                conn.outputStream.use { it.write(json.toByteArray()) }
                val status = conn.responseCode
                Log.d("YapeListener", "POST enviado → HTTP $status | RUC: $empresaRuc | Sucursal: $sucursalId")
                conn.disconnect()
            } catch (e: Exception) {
                Log.e("YapeListener", "Error POST: ${e.message}")
            } finally {
                if (wakeLock.isHeld) wakeLock.release()
            }
        }.start()
    }
}
