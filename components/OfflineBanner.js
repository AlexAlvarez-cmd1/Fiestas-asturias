import NetInfo from '@react-native-community/netinfo';
import { useEffect, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

export default function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);
  const [wasOffline, setWasOffline] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const unsub = NetInfo.addEventListener(state => {
      const offline = !state.isConnected || state.isConnected === null;
      setIsOffline(prev => {
        if (!offline && prev) setWasOffline(true);
        return offline;
      });
    });
    return unsub;
  }, []);

  useEffect(() => {
    if (isOffline || wasOffline) {
      Animated.timing(opacity, { toValue: 1, duration: 300, useNativeDriver: true }).start();
      if (wasOffline) {
        const t = setTimeout(() => {
          Animated.timing(opacity, { toValue: 0, duration: 500, useNativeDriver: true }).start(() => setWasOffline(false));
        }, 2500);
        return () => clearTimeout(t);
      }
    } else {
      Animated.timing(opacity, { toValue: 0, duration: 300, useNativeDriver: true }).start();
    }
  }, [isOffline, wasOffline]);

  if (!isOffline && !wasOffline) return null;

  return (
    <Animated.View style={[styles.banner, isOffline ? styles.offline : styles.online, { opacity }]}>
      <Text style={styles.txt}>
        {isOffline ? '📡 Sin conexión — mostrando datos en caché' : '✅ Conexión restaurada'}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute', top: 0, left: 0, right: 0,
    paddingVertical: 8, paddingHorizontal: 16,
    zIndex: 999, alignItems: 'center',
  },
  offline: { backgroundColor: '#ef4444' },
  online:  { backgroundColor: '#22c55e' },
  txt: { color: 'white', fontWeight: '700', fontSize: 13 },
});
