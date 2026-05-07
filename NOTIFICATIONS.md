# 📱 Sistema de Notificaciones Push - Fiestas Asturias

## Descripción General

El sistema de notificaciones push está **completamente implementado** y automático. Se ejecuta en background desde que abres la app y monitorea dos cosas:

1. **Fiestas Favoritas**: Te notifica cuando una fiesta que marcaste como favorita se acerca
2. **Fiestas Cercanas**: Te notifica cuando hay una fiesta cerca de tu ubicación

---

## 🏗️ Arquitectura

### Servicios Implementados

#### 1. **notificationService.ts**
- Maneja permisos y envío de notificaciones
- Configura listeners para notificaciones recibidas y presionadas
- Métodos principales:
  - `requestPermissions()` - Solicitar permisos
  - `sendLocalNotification(title, body, data)` - Enviar notif inmediata
  - `scheduleNotification(title, body, date, data)` - Programar notif

#### 2. **geoService.ts**
- Gestiona ubicación del usuario
- Calcula distancias entre puntos (Haversine formula)
- Verifica si una fiesta está dentro de un radio
- Calcula días hasta una fiesta
- Métodos principales:
  - `getCurrentLocation()` - Obtener GPS actual
  - `calculateDistance(lat1, lon1, lat2, lon2)` - Distancia en km
  - `isFiestaWithinRadius(fiesta, userLoc, radiusKm)` - Fiesta cercana
  - `getDaysUntilFiesta(fecha)` - Días restantes

#### 3. **favoritesService.ts**
- Almacena favoritos en AsyncStorage (local, sin internet)
- Previene notificaciones duplicadas
- Métodos principales:
  - `addFavorite(fiestaId)` - Marcar como favorita
  - `removeFavorite(fiestaId)` - Desmarcar
  - `getFavorites()` - Obtener lista
  - `markFavoriteNotified(fiestaId)` - Marcar como ya notificada

#### 4. **fiestasMonitorService.ts**
- Orquesta todo el sistema
- Verifica favoritos próximos y fiestas cercanas
- Se ejecuta cada 1 hora automáticamente
- Métodos principales:
  - `startMonitoring()` - Iniciar monitoreo automático
  - `checkFavoritesNotifications()` - Verificar favoritas
  - `checkNearbyFiestasNotifications()` - Verificar cercanas
  - `stopMonitoring()` - Detener monitoreo

---

## 🔄 Flujo de Funcionamiento

### Al iniciar la app:

```
1. _layout.js -> useEffect()
   ↓
2. Solicitar permisos de notificaciones
   ↓
3. Obtener token de Expo Push (para notificaciones remotas)
   ↓
4. Iniciar listeners para notificaciones presionadas
   ↓
5. Llamar fiestasMonitorService.startMonitoring()
   ↓
6. Ejecutar verificaciones inmediatamente
   ↓
7. Programar verificaciones cada 1 hora en background
```

### Verificación de Favoritas (cada 1 hora):

```
1. Obtener lista de favoritos del usuario
   ↓
2. Para cada favorita:
   - Calcular días hasta la fiesta
   - Si falta 7 días → Notificar: "¡Tu fiesta favorita se acerca!"
   - Si falta 3 días → Notificar: "¡Tu favorita es en 3 días!"
   - Si falta 1 día → Notificar: "¡Mañana es tu fiesta favorita!"
   - Si ya notificamos → No notificar de nuevo
```

### Verificación de Cercanas (cada 1 hora):

```
1. Obtener ubicación GPS actual del usuario
   ↓
2. Obtener todas las fiestas de Firestore
   ↓
3. Para cada fiesta:
   - Calcular distancia del usuario
   - Si distancia < 20 km Y fecha < 7 días:
     → Notificar: "🎉 ¡Hay una fiesta cerca! (X km)"
   - Si ya notificamos → No notificar de nuevo
```

---

## 🎯 Cómo Usar

### Marcar una Fiesta como Favorita

```javascript
// En detalle.js está el botón ❤️ en el header
// Al presionar:
const { isFavorite, toggleFavorite } = useFavorite(fiestaId);

// Presionar botón:
await toggleFavorite(); // Marca/desmarca automáticamente
```

### O programáticamente:

```javascript
import { favoritesService } from './services/favoritesService';

// Agregar favorito
await favoritesService.addFavorite(fiestaId);

// Remover favorito
await favoritesService.removeFavorite(fiestaId);

// Verificar si es favorito
const isFav = await favoritesService.isFavorite(fiestaId);
```

### Obtener Notificaciones en Tiempo Real

```javascript
import { notificationService } from './services/notificationService';

// Escuchar notificaciones recibidas
const sub = notificationService.onNotificationReceived((notification) => {
  console.log('Notificación recibida:', notification);
});

// Escuchar cuando el usuario presiona la notificación
const sub2 = notificationService.onNotificationPressed((response) => {
  console.log('Notificación presionada:', response.notification.request.content.data);
});

// Limpiar listeners
notificationService.removeListeners([sub, sub2]);
```

---

## ⚙️ Configuración

### En _layout.js:

```javascript
// Parámetros del monitoreo:
monitoringIntervalRef.current = await fiestasMonitorService.startMonitoring(
  20, // radiusKm - Radio para detectar fiestas cercanas
  7,  // diasAnticipacion - Cuántos días antes notificar
  1   // checkIntervalHours - Cada cuántas horas verificar
);
```

**Puedes cambiar estos valores según tus necesidades:**
- `radiusKm`: Si quieres notificaciones de fiestas más o menos lejanas
- `diasAnticipacion`: Cuántos días antes empezar a notificar sobre cercanas
- `checkIntervalHours`: Si quieres verificaciones más frecuentes (ej: 0.5 = cada 30 min)

---

## 📲 Estructura de Datos

### Fiesta (en Firestore):

```javascript
{
  id: string,
  nombre: string,
  fecha: string, // "2025-05-20"
  concejo: string, // "Oviedo"
  orquesta: string,
  ubicacion: GeoPoint {
    latitude: number,
    longitude: number
  },
  imagen: string // URL
}
```

### Favoritos (en AsyncStorage):

```javascript
// Clave: "fiestas_favoritas"
// Valor: ["id1", "id2", "id3"]

// Ya notificadas:
// Clave: "fiestas_notificadas_favoritas"
// Valor: ["id1", "id2"]

// Ya notificadas cercanas:
// Clave: "fiestas_notificadas_cercanas"
// Valor: ["id1", "id2"]
```

---

## 🔔 Tipos de Notificaciones

### Favoritas:

| Situación | Mensaje |
|-----------|---------|
| 7 días antes | "⭐ ¡Tu fiesta favorita se acerca! ... en una semana" |
| 3 días antes | "⭐ ¡Tu favorita es en 3 días! ..." |
| 1 día antes | "⭐ ¡Mañana es tu fiesta favorita! 🎉" |

### Cercanas:

| Situación | Mensaje |
|-----------|---------|
| Fiesta < 20 km y < 7 días | "🎉 ¡Hay una fiesta cerca! (X km)" |

---

## 🐛 Debugging

### Ver logs en consola:

Abre la aplicación en desarrollo y mira la consola. Verás logs como:

```
✅ Permisos de notificaciones otorgados
📱 Token de notificaciones: [token]
🚀 Iniciando monitoreo de notificaciones...
🔔 Verificando fiestas favoritas...
✅ Notificación enviada: Mi Fiesta (7 días)
🗺️ Verificando fiestas cercanas (20 km)...
✅ Notificación cercana enviada: Otra Fiesta (15 km)
```

### Forzar verificación:

En la consola de React Native:

```javascript
import { fiestasMonitorService } from './services/fiestasMonitorService';

// Verificar favoritas ahora
await fiestasMonitorService.checkFavoritesNotifications();

// Verificar cercanas ahora
await fiestasMonitorService.checkNearbyFiestasNotifications(20, 7);
```

---

## 🚀 Mejoras Futuras

- [ ] Notificaciones remotas con Firebase Cloud Messaging (FCM)
- [ ] Permitir al usuario personalizar el radio de cercanas
- [ ] Permitir al usuario personalizar días de anticipación
- [ ] Silenciar notificaciones por horario (ej: no después de las 22h)
- [ ] Historial de notificaciones recibidas
- [ ] Compartir fiesta en redes sociales
- [ ] Recordatorios a hora específica de la fiesta

---

## 📚 Archivos Principales

```
services/
├── notificationService.ts      # Gestión de notificaciones
├── geoService.ts               # Geolocalización y distancias
├── favoritesService.ts         # Almacenamiento de favoritos
└── fiestasMonitorService.ts    # Orquestador principal

hooks/
├── useFavorite.ts              # Hook para favoritos
└── use-color-scheme.ts         # (existente)

app/
├── _layout.js                  # Inicializa notificaciones
├── detalle.js                  # Botón favorito + detalles
└── (tabs)/
    ├── index.js                # Home
    └── mapa.js                 # Mapa de fiestas
```

---

## ✅ Estado de Implementación

- ✅ Notificaciones locales (funciona perfectamente)
- ✅ Monitoreo automático de favoritas
- ✅ Monitoreo automático de cercanas
- ✅ Interfaz de favoritos
- ⏳ Notificaciones remotas (servidor necesario)

---

**¡Sistema listo para usar!** 🎉
