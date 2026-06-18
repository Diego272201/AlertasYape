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
  Image,
} from 'react-native';
import {
  Camera,
  useCameraDevice,
  useCodeScanner,
} from 'react-native-vision-camera';
import {
  Camera as CameraIcon,
  AlertTriangle,
  Inbox,
  Bell,
  Zap,
  RefreshCw,
} from 'lucide-react-native';

const {NotifPermission} = NativeModules;
const LOGO = require('./public/logoapp.png');

// Altura de la barra de estado para extender el header detrás de ella
const STATUS_H =
  Platform.OS === 'android' ? StatusBar.currentHeight ?? 24 : 47;

// ─── Paleta ──────────────────────────────────────────────────────────────────
const P = {
  p900: '#10002B',
  p800: '#240046',
  p700: '#3C096C',
  p600: '#5A189A',
  p500: '#7B2CBF',
  p400: '#9D4EDD',
  p300: '#C77DFF',
  p200: '#E0AAFF',
  white: '#FFFFFF',
  green: '#34d399',
  red: '#f87171',
  amber: '#fbbf24',
};
const W = (o: number) => `rgba(255,255,255,${o})`;

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

// ─── Header con degradado simulado, extendido tras la status bar ──────────────
function Header({
  title,
  subtitle,
  right,
}: {
  title: string;
  subtitle: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={h.root}>
      {/* Capas de degradado */}
      <View style={[StyleSheet.absoluteFill, {backgroundColor: P.p700}]} />
      <View
        style={[
          StyleSheet.absoluteFill,
          {backgroundColor: P.p900, opacity: 0.45, top: '0%'},
        ]}
      />
      {/* Brillo decorativo superior-derecha */}
      <View style={h.glow} />

      <View style={h.bar}>
        <Image source={LOGO} style={h.logo} />
        <View style={{flex: 1}}>
          <Text style={h.title}>{title}</Text>
          <Text style={h.sub}>{subtitle}</Text>
        </View>
        {right}
      </View>
    </View>
  );
}
const h = StyleSheet.create({
  root: {
    paddingTop: STATUS_H,
    overflow: 'hidden',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
  },
  glow: {
    position: 'absolute',
    top: -40,
    right: -30,
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: P.p400,
    opacity: 0.25,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 22,
  },
  logo: {width: 42, height: 42, borderRadius: 12},
  title: {fontSize: 18, fontWeight: '800', color: P.white, letterSpacing: 0.2},
  sub: {fontSize: 11.5, color: W(0.65), marginTop: 2},
});

// ─── Pill de estado ───────────────────────────────────────────────────────────
function StatusPill({active}: {active: boolean}) {
  const c = active ? P.green : P.red;
  return (
    <View style={pill.wrap}>
      <View style={{alignItems: 'center', justifyContent: 'center'}}>
        <View style={[pill.halo, {backgroundColor: c}]} />
        <View style={[pill.dot, {backgroundColor: c}]} />
      </View>
      <Text style={[pill.text, {color: c}]}>{active ? 'Activo' : 'Inactivo'}</Text>
    </View>
  );
}
const pill = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    backgroundColor: W(0.08),
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: 1,
    borderColor: W(0.12),
  },
  halo: {position: 'absolute', width: 18, height: 18, borderRadius: 9, opacity: 0.25},
  dot: {width: 8, height: 8, borderRadius: 4},
  text: {fontSize: 12, fontWeight: '700'},
});

// ─── Card glassmorphism ───────────────────────────────────────────────────────
function Card({children, style}: {children: React.ReactNode; style?: object}) {
  return <View style={[card.box, style]}>{children}</View>;
}
const card = StyleSheet.create({
  box: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: P.p800,
    borderRadius: 22,
    padding: 20,
    borderWidth: 1,
    borderColor: W(0.08),
  },
});

// ─── Esquinas del visor QR ────────────────────────────────────────────────────
function QrFrame() {
  const s = 210,
    arm = 28,
    t = 3.5;
  const corners = [
    {top: 0, left: 0, borderTopWidth: t, borderLeftWidth: t, borderTopLeftRadius: 12},
    {top: 0, right: 0, borderTopWidth: t, borderRightWidth: t, borderTopRightRadius: 12},
    {bottom: 0, left: 0, borderBottomWidth: t, borderLeftWidth: t, borderBottomLeftRadius: 12},
    {bottom: 0, right: 0, borderBottomWidth: t, borderRightWidth: t, borderBottomRightRadius: 12},
  ];
  return (
    <View style={{width: s, height: s}}>
      {corners.map((c, i) => (
        <View
          key={i}
          style={[{position: 'absolute', width: arm, height: arm, borderColor: P.p300}, c]}
        />
      ))}
    </View>
  );
}

// ─── Pantalla de configuración ────────────────────────────────────────────────
function SetupScreen({onSave}: {onSave: (c: Config) => void}) {
  const [hasCamPerm, setHasCamPerm] = useState(false);
  const [scanned, setScanned] = useState(false);
  const device = useCameraDevice('back');

  useEffect(() => {
    Camera.requestCameraPermission().then(st => setHasCamPerm(st === 'granted'));
  }, []);

  const codeScanner = useCodeScanner({
    codeTypes: ['qr'],
    onCodeScanned: useCallback(
      (codes: any[]) => {
        if (scanned || !codes.length) return;
        try {
          const p = JSON.parse(codes[0].value ?? '');
          if (!p.empresaRuc || !p.sucursalId) throw new Error();
          setScanned(true);
          onSave({empresaRuc: String(p.empresaRuc), sucursalId: String(p.sucursalId)});
        } catch {
          Alert.alert('QR inválido', 'Este código no pertenece a FactuFly.');
        }
      },
      [scanned, onSave],
    ),
  });

  return (
    <View style={s.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <Header title="FactuFly Alertas" subtitle="Configuración inicial" />

      <Card>
        <Text style={s.badge}>PASO ÚNICO</Text>
        <Text style={s.cardTitle}>Escanea el QR de tu empresa</Text>
        <Text style={s.cardDesc}>
          Abre FactuFly en el navegador, ve a tu perfil y apunta la cámara al código QR.
        </Text>
      </Card>

      {!hasCamPerm ? (
        <Card style={{flex: 1, justifyContent: 'center'}}>
          <View style={s.center}>
            <View style={s.iconCircle}>
              <CameraIcon size={30} color={P.p200} strokeWidth={2} />
            </View>
            <Text style={s.placeTitle}>Acceso a cámara requerido</Text>
            <Text style={s.placeDesc}>Necesitamos la cámara para leer tu código QR</Text>
            <TouchableOpacity
              style={[s.btn, s.btnRow]}
              onPress={() =>
                Camera.requestCameraPermission().then(st => setHasCamPerm(st === 'granted'))
              }>
              <CameraIcon size={18} color={P.white} strokeWidth={2.2} />
              <Text style={s.btnText}>Permitir cámara</Text>
            </TouchableOpacity>
          </View>
        </Card>
      ) : device ? (
        <View style={s.camWrap}>
          <Camera
            style={StyleSheet.absoluteFill}
            device={device}
            isActive={!scanned}
            codeScanner={codeScanner}
          />
          <View style={s.camDimTop} />
          <View style={s.camMid}>
            <View style={s.camDimSide} />
            <QrFrame />
            <View style={s.camDimSide} />
          </View>
          <View style={s.camDimBottom}>
            <Text style={s.camHint}>Apunta al código QR de FactuFly</Text>
          </View>
        </View>
      ) : (
        <Card style={{flex: 1, justifyContent: 'center'}}>
          <View style={s.center}>
            <View style={s.iconCircle}>
              <AlertTriangle size={30} color={P.amber} strokeWidth={2} />
            </View>
            <Text style={s.placeTitle}>Cámara no disponible</Text>
          </View>
        </Card>
      )}
    </View>
  );
}

// ─── Pantalla principal ───────────────────────────────────────────────────────
export default function App() {
  const [config, setConfig] = useState<Config | null>(null);
  const [authorized, setAuth] = useState(false);
  const [batteryOk, setBattery] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [editando, setEditando] = useState(false);

  const addLog = (text: string, type: LogEntry['type'] = 'info') =>
    setLogs(prev => [
      {
        id: `${Date.now()}-${Math.random()}`,
        text,
        type,
        time: new Date().toLocaleTimeString('es-PE'),
      },
      ...prev.slice(0, 49),
    ]);

  const checkPerm = async () => {
    setAuth(await NotifPermission.isGranted());
    setBattery(await NotifPermission.isBatteryOptimizationIgnored());
  };

  useEffect(() => {
    NotifPermission.getConfig().then((v: Config) => {
      if (v.empresaRuc) setConfig(v);
    });
  }, []);

  useEffect(() => {
    checkPerm();
    const sub = AppState.addEventListener('change', st => {
      if (st === 'active') checkPerm();
    });
    return () => sub.remove();
  }, []);

  useEffect(() => {
    if (authorized && config) {
      addLog('Servicio activo — escuchando Yape en background', 'success');
      addLog(`RUC ${config.empresaRuc} · Sucursal ${config.sucursalId}`, 'info');
    }
  }, [authorized, config]);

  if (!config || editando) {
    return (
      <SetupScreen
        onSave={c => {
          NotifPermission.saveConfig(c.empresaRuc, c.sucursalId);
          setConfig(c);
          setEditando(false);
        }}
      />
    );
  }

  const allOk = authorized && batteryOk;

  return (
    <View style={s.root}>
      <StatusBar translucent backgroundColor="transparent" barStyle="light-content" />
      <Header
        title="FactuFly Alertas"
        subtitle="Monitor de pagos Yape"
        right={<StatusPill active={allOk} />}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{paddingBottom: 40}}>
        {/* Estado del servicio */}
        <Card>
          <View style={s.rowBetween}>
            <View style={{flex: 1, paddingRight: 12}}>
              <Text style={s.badge}>ESTADO DEL SERVICIO</Text>
              <Text style={s.cardTitle}>
                {authorized ? 'Escuchando pagos' : 'Permiso requerido'}
              </Text>
              <Text style={s.cardDesc}>
                {authorized
                  ? 'Los cobros Yape se registran automáticamente en FactuFly'
                  : 'Activa el acceso a notificaciones para comenzar'}
              </Text>
            </View>
            <View style={{alignItems: 'center', justifyContent: 'center'}}>
              <View style={[s.bigHalo, {backgroundColor: allOk ? P.green : P.red}]} />
              <View style={[s.bigDot, {backgroundColor: allOk ? P.green : P.red}]} />
            </View>
          </View>
        </Card>

        {/* Acciones requeridas */}
        {!authorized && (
          <TouchableOpacity
            style={[s.btn, s.btnRow]}
            onPress={() =>
              Alert.alert(
                'Permiso necesario',
                'Ajustes → Acceso a notificaciones → Activa FactuFly Alertas.',
                [
                  {text: 'Cancelar', style: 'cancel'},
                  {text: 'Abrir Ajustes', onPress: () => NotifPermission.openSettings()},
                ],
              )
            }>
            <Bell size={18} color={P.white} strokeWidth={2.2} />
            <Text style={s.btnText}>Activar acceso a notificaciones</Text>
          </TouchableOpacity>
        )}

        {!batteryOk && (
          <TouchableOpacity
            style={[s.btn, s.btnAmber, s.btnRow]}
            onPress={() => NotifPermission.requestIgnoreBatteryOptimization()}>
            <Zap size={18} color={P.amber} strokeWidth={2.2} />
            <Text style={[s.btnText, {color: P.amber}]}>
              Desactivar optimización de batería
            </Text>
          </TouchableOpacity>
        )}

        {/* Empresa */}
        <Card>
          <Text style={s.badge}>EMPRESA</Text>
          <View style={s.empresaRow}>
            <View style={{flex: 1}}>
              <Text style={s.empresaLabel}>RUC</Text>
              <Text style={s.empresaVal}>{config.empresaRuc}</Text>
            </View>
            <View style={s.empresaDivider} />
            <View style={{flex: 1}}>
              <Text style={s.empresaLabel}>SUCURSAL</Text>
              <Text style={s.empresaVal}>#{config.sucursalId}</Text>
            </View>
            <TouchableOpacity
              style={[s.cambiarBtn, s.btnRow]}
              onPress={() =>
                Alert.alert('Cambiar configuración', '¿Quieres escanear un nuevo QR?', [
                  {text: 'Cancelar', style: 'cancel'},
                  {
                    text: 'Sí, cambiar',
                    onPress: () => {
                      NotifPermission.saveConfig('', '');
                      setConfig(null);
                      setEditando(true);
                    },
                  },
                ])
              }>
              <RefreshCw size={13} color={P.p300} strokeWidth={2.3} />
              <Text style={s.cambiarText}>Cambiar</Text>
            </TouchableOpacity>
          </View>
        </Card>

        {/* Actividad */}
        <View style={{marginHorizontal: 16, marginTop: 22}}>
          <View style={s.rowBetween}>
            <Text style={s.sectionTitle}>Actividad</Text>
            <Text style={s.sectionCount}>{logs.length} registros</Text>
          </View>
          <View style={s.logBox}>
            {logs.length === 0 ? (
              <View style={s.center}>
                <Inbox size={26} color={W(0.3)} strokeWidth={1.8} />
                <Text style={[s.logEmptyText, {marginTop: 10}]}>Sin actividad aún</Text>
              </View>
            ) : (
              logs.map(e => (
                <View key={e.id} style={s.logRow}>
                  <View
                    style={[
                      s.logDot,
                      {
                        backgroundColor:
                          e.type === 'success'
                            ? P.green
                            : e.type === 'error'
                            ? P.red
                            : P.p300,
                      },
                    ]}
                  />
                  <View style={{flex: 1}}>
                    <Text style={s.logText}>{e.text}</Text>
                    <Text style={s.logTime}>{e.time}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        </View>

        <Text style={s.footNote}>Funciona aunque la app esté cerrada</Text>
      </ScrollView>
    </View>
  );
}

// ─── Estilos ──────────────────────────────────────────────────────────────────
const s = StyleSheet.create({
  root: {flex: 1,backgroundColor: '#fbfaff',},

  rowBetween: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  center: {alignItems: 'center', justifyContent: 'center', paddingVertical: 20},

  // Tipografía de cards
  badge: {
    fontSize: 10,
    fontWeight: '800',
    color: P.p200,
    letterSpacing: 1.4,
    marginBottom: 7,
  },
  cardTitle: {fontSize: 19, fontWeight: '800', color: P.white, lineHeight: 25, marginBottom: 6},
  cardDesc: {fontSize: 13, color: W(0.9), lineHeight: 19},

  // Botones
  btn: {
    marginHorizontal: 16,
    marginTop: 14,
    backgroundColor: P.p500,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 9,
  },
  btnAmber: {
    backgroundColor: 'rgba(251,191,36,0.14)',
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.3)',
  },
  btnText: {color: P.white, fontWeight: '700', fontSize: 14, letterSpacing: 0.2},

  // Big dot estado
  bigHalo: {position: 'absolute', width: 38, height: 38, borderRadius: 19, opacity: 0.16},
  bigDot: {width: 16, height: 16, borderRadius: 8},

  // Empresa
  empresaRow: {flexDirection: 'row', alignItems: 'center', gap: 14},
  empresaLabel: {fontSize: 10, fontWeight: '800', color: W(0.55), letterSpacing: 1, marginBottom: 4},
  empresaVal: {fontSize: 16, fontWeight: '800', color: P.white},
  empresaDivider: {width: 1, height: 38, backgroundColor: W(0.12)},
  cambiarBtn: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 11,
    backgroundColor: 'rgba(157,78,221,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(157,78,221,0.4)',
  },
  cambiarText: {fontSize: 12, fontWeight: '700', color: P.p300},

  // Actividad
  sectionTitle: {fontSize: 15, fontWeight: '800', color: P.white},
  sectionCount: {fontSize: 11, color: W(0.4)},
  logBox: {
    marginTop: 12,
    backgroundColor: P.p800,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: W(0.07),
    gap: 13,
  },
  logEmptyText: {fontSize: 13, color: W(0.35)},
  logRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 11},
  logDot: {width: 7, height: 7, borderRadius: 4, marginTop: 5},
  logText: {fontSize: 12.5, color: W(0.85), lineHeight: 18},
  logTime: {fontSize: 10, color: W(0.38), marginTop: 2},

  footNote: {textAlign: 'center', fontSize: 11, color: W(0.32), marginTop: 26, letterSpacing: 0.2},

  // Placeholder cámara
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: P.p700,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  placeTitle: {fontSize: 16, fontWeight: '700', color: P.white, marginBottom: 6},
  placeDesc: {fontSize: 13, color: W(0.55), textAlign: 'center', lineHeight: 19, marginBottom: 18},

  // Cámara
  camWrap: {
    flex: 1,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: W(0.12),
  },
  camDimTop: {flex: 1, backgroundColor: 'rgba(16,0,43,0.7)'},
  camMid: {flexDirection: 'row', alignItems: 'center'},
  camDimSide: {flex: 1, height: 210, backgroundColor: 'rgba(16,0,43,0.7)'},
  camDimBottom: {
    flex: 1,
    backgroundColor: 'rgba(16,0,43,0.7)',
    alignItems: 'center',
    paddingTop: 18,
  },
  camHint: {fontSize: 13, fontWeight: '600', color: P.white, letterSpacing: 0.3},
});
