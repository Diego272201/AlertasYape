import React, {useEffect, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  AppState,
  Alert,
  StatusBar,
  Platform,
  NativeModules,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';

const {NotifPermission} = NativeModules;

interface Config {
  empresaRuc: string;
  sucursalId: string;
}

interface LogEntry {
  id: string;
  text: string;
  type: 'info' | 'success' | 'error';
  time: string;
}

// ─── Pantalla de escaneo QR ───────────────────────────────────────────────────
function SetupScreen({onSave}: {onSave: (c: Config) => void}) {
  const [hasCamPerm, setHasCamPerm] = useState(false);
  const [scanned, setScanned] = useState(false);
  const device = useCameraDevice('back');

  useEffect(() => {
    Camera.requestCameraPermission().then(status => {
      setHasCamPerm(status === 'granted');
    });
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback(
      (codes: any[]) => {
        if (scanned || codes.length === 0) return;
        const value = codes[0].value ?? '';
        try {
          // QR esperado: {"empresaRuc":"20123456789","sucursalId":"3"}
          const parsed = JSON.parse(value);
          if (!parsed.empresaRuc || !parsed.sucursalId) throw new Error();
          setScanned(true);
          onSave({
            empresaRuc: String(parsed.empresaRuc),
            sucursalId: String(parsed.sucursalId),
          });
        } catch {
          Alert.alert(
            'QR inválido',
            'El código QR no es de FactuFly. Inténtalo de nuevo.',
          );
        }
      },
      [scanned, onSave],
    ),
  });

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#6D1FCA" barStyle="light-content" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>FactuFly Alertas</Text>
        <Text style={styles.headerSub}>Configuración inicial</Text>
      </View>

      <View style={styles.setupCard}>
        <Text style={styles.setupTitle}>Escanea el QR de tu empresa</Text>
        <Text style={styles.setupDesc}>
          Inicia sesión en FactuFly desde el navegador y escanea el código QR
          que aparece en tu perfil.
        </Text>
      </View>

      {/* Visor QR */}
      {!hasCamPerm ? (
        <View style={styles.camPlaceholder}>
          <Text style={styles.camPlaceholderText}>
            Se necesita permiso de cámara
          </Text>
          <TouchableOpacity
            style={[styles.btnPermiso, {marginTop: 12, marginHorizontal: 0}]}
            onPress={() =>
              Camera.requestCameraPermission().then(s =>
                setHasCamPerm(s === 'granted'),
              )
            }>
            <Text style={styles.btnPermisoText}>Permitir cámara</Text>
          </TouchableOpacity>
        </View>
      ) : device ? (
        <View style={styles.camContainer}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!scanned}
            codeScanner={codeScanner}
          />
          {/* Marco de enfoque */}
          <View style={styles.camOverlay}>
            <View style={styles.camFrame} />
            <Text style={styles.camHint}>Apunta al código QR de FactuFly</Text>
          </View>
        </View>
      ) : (
        <View style={styles.camPlaceholder}>
          <Text style={styles.camPlaceholderText}>Cámara no disponible</Text>
        </View>
      )}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const [batteryOk, setBatteryOk] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [editando, setEditando] = useState(false);

  const addLog = (text: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('es-PE');
    setLogs(prev => [
      {id: `${Date.now()}-${Math.random()}`, text, type, time},
      ...prev.slice(0, 49),
    ]);
  };

  const checkPermission = async () => {
    const granted = await NotifPermission.isGranted();
    setAuthorized(granted);
    const battIgnored = await NotifPermission.isBatteryOptimizationIgnored();
    setBatteryOk(battIgnored);
  };

  // Cargar config guardada desde SharedPreferences
  useEffect(() => {
    NotifPermission.getConfig().then((val: Config) => {
      if (val.empresaRuc) setConfig(val);
    });
  }, []);

  useEffect(() => {
    checkPermission();
    const sub = AppState.addEventListener('change', state => {
      if (state === 'active') checkPermission();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (authorized && config) {
      addLog('Servicio activo — escuchando Yape en background', 'success');
      addLog(
        `Empresa RUC: ${config.empresaRuc} | Sucursal: ${config.sucursalId}`,
        'info',
      );
    }
  }, [authorized, config]);

  const handleSaveConfig = (c: Config) => {
    NotifPermission.saveConfig(c.empresaRuc, c.sucursalId);
    setConfig(c);
    setEditando(false);
  };

  const handleReset = () => {
    Alert.alert('Cambiar configuración', '¿Deseas cambiar el RUC y sucursal?', [
      {text: 'Cancelar', style: 'cancel'},
      {
        text: 'Sí, cambiar',
        onPress: () => {
          NotifPermission.saveConfig('', '');
          setConfig(null);
          setEditando(true);
        },
      },
    ]);
  };

  const requestPermission = () => {
    Alert.alert(
      'Permiso necesario',
      'Se abrirá Ajustes → Acceso a notificaciones.\nActiva "FactuFly Alertas" y vuelve.',
      [
        {text: 'Cancelar', style: 'cancel'},
        {text: 'Ir a Ajustes', onPress: () => NotifPermission.openSettings()},
      ],
    );
  };

  // Primera vez o editando
  if (!config || editando) {
    return <SetupScreen onSave={handleSaveConfig} />;
  }

  return (
    <View style={styles.container}>
      <StatusBar backgroundColor="#6D1FCA" barStyle="light-content" />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>FactuFly Alertas</Text>
        <Text style={styles.headerSub}>Monitor de pagos Yape</Text>
      </View>

      {/* Estado */}
      <View style={styles.statusCard}>
        <View
          style={[
            styles.dot,
            authorized ? styles.dotActive : styles.dotInactive,
          ]}
        />
        <View style={{flex: 1}}>
          <Text style={styles.statusTitle}>
            {authorized ? 'Escuchando en background' : 'Permiso requerido'}
          </Text>
          <Text style={styles.statusSub}>
            {authorized
              ? 'Los pagos Yape se envían automáticamente al sistema'
              : 'Necesitas activar el acceso a notificaciones'}
          </Text>
        </View>
      </View>

      {!authorized && (
        <TouchableOpacity style={styles.btnPermiso} onPress={requestPermission}>
          <Text style={styles.btnPermisoText}>
            Activar acceso a notificaciones
          </Text>
        </TouchableOpacity>
      )}

      {!batteryOk && (
        <TouchableOpacity
          style={[styles.btnPermiso, {backgroundColor: '#e67e00', marginTop: 0}]}
          onPress={() => NotifPermission.requestIgnoreBatteryOptimization()}>
          <Text style={styles.btnPermisoText}>
            Desactivar optimización de batería
          </Text>
        </TouchableOpacity>
      )}

      {/* Info empresa */}
      <View style={styles.infoBox}>
        <View style={{flex: 1}}>
          <Text style={styles.infoLabel}>EMPRESA</Text>
          <Text style={styles.infoValue}>
            RUC {config.empresaRuc} · Sucursal {config.sucursalId}
          </Text>
        </View>
        <TouchableOpacity onPress={handleReset}>
          <Text style={styles.linkCambiar}>Cambiar</Text>
        </TouchableOpacity>
      </View>

      {/* Log */}
      <Text style={styles.logTitle}>Actividad</Text>
      <ScrollView style={styles.logBox} showsVerticalScrollIndicator={false}>
        {logs.length === 0 ? (
          <Text style={styles.logEmpty}>Aún no hay actividad…</Text>
        ) : (
          logs.map(entry => (
            <View key={entry.id} style={styles.logRow}>
              <Text style={styles.logTime}>{entry.time}</Text>
              <Text
                style={[
                  styles.logText,
                  entry.type === 'success' && styles.logSuccess,
                  entry.type === 'error' && styles.logError,
                ]}>
                {entry.text}
              </Text>
            </View>
          ))
        )}
      </ScrollView>

      <Text style={styles.nota}>
        El servicio funciona aunque la app esté cerrada
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {flex: 1, backgroundColor: '#f5f8ff'},
  header: {
    backgroundColor: '#6D1FCA',
    paddingTop: Platform.OS === 'android' ? 48 : 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
  },
  headerTitle: {fontSize: 22, fontWeight: '700', color: '#fff'},
  headerSub: {fontSize: 13, color: 'rgba(255,255,255,0.7)', marginTop: 2},
  setupCard: {
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: '#E2EAF6',
    elevation: 2,
  },
  setupTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: '#0f2e64',
    marginBottom: 6,
  },
  setupDesc: {fontSize: 13, color: '#94a3b8', lineHeight: 18},
  camContainer: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    overflow: 'hidden',
  },
  camOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
  },
  camFrame: {
    width: 220,
    height: 220,
    borderWidth: 3,
    borderColor: '#6D1FCA',
    borderRadius: 16,
    backgroundColor: 'transparent',
  },
  camHint: {
    marginTop: 16,
    color: '#fff',
    fontSize: 13,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.8)',
    textShadowOffset: {width: 0, height: 1},
    textShadowRadius: 4,
  },
  camPlaceholder: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  camPlaceholderText: {color: '#94a3b8', fontSize: 14, textAlign: 'center'},
  statusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    margin: 16,
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E2EAF6',
    elevation: 2,
  },
  dot: {width: 14, height: 14, borderRadius: 7},
  dotActive: {backgroundColor: '#22c55e'},
  dotInactive: {backgroundColor: '#94a3b8'},
  statusTitle: {fontSize: 15, fontWeight: '600', color: '#0f2e64'},
  statusSub: {fontSize: 12, color: '#94a3b8', marginTop: 2},
  btnPermiso: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#6D1FCA',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  btnPermisoText: {color: '#fff', fontWeight: '700', fontSize: 14},
  infoBox: {
    marginHorizontal: 16,
    marginBottom: 12,
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E2EAF6',
    flexDirection: 'row',
    alignItems: 'center',
  },
  infoLabel: {fontSize: 11, fontWeight: '700', color: '#6D1FCA'},
  infoValue: {fontSize: 12, color: '#64748b', marginTop: 2},
  linkCambiar: {fontSize: 12, color: '#6D1FCA', fontWeight: '600'},
  logTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginHorizontal: 16,
    marginBottom: 6,
  },
  logBox: {
    flex: 1,
    marginHorizontal: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 12,
  },
  logEmpty: {
    color: '#475569',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 20,
  },
  logRow: {marginBottom: 6},
  logTime: {fontSize: 10, color: '#475569'},
  logText: {fontSize: 12, color: '#cbd5e1', lineHeight: 18},
  logSuccess: {color: '#4ade80'},
  logError: {color: '#f87171'},
  nota: {
    textAlign: 'center',
    fontSize: 11,
    color: '#94a3b8',
    marginVertical: 12,
  },
});
