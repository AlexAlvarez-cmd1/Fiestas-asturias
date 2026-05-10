import { Image } from 'expo-image';
import { useEffect, useRef, useState } from 'react';
import { Dimensions, Modal, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

const { width, height } = Dimensions.get('window');

export default function ImageModal({ visible, onClose, imageUrl, footer }) {
  const [mounted, setMounted] = useState(false);

  const stableUrl = useRef(imageUrl);
  const stableFooter = useRef(footer);
  if (visible) {
    if (imageUrl) stableUrl.current = imageUrl;
    stableFooter.current = footer;
  }

  const bgOpacity = useSharedValue(0);
  const contentScale = useSharedValue(0.9);
  const pinchScale = useSharedValue(1);
  const savedScale = useSharedValue(1);

  useEffect(() => {
    if (visible) {
      pinchScale.value = 1;
      savedScale.value = 1;
      setMounted(true);
      bgOpacity.value = withTiming(1, { duration: 180 });
      contentScale.value = withSpring(1, { damping: 20, stiffness: 300 });
    } else {
      bgOpacity.value = withTiming(0, { duration: 160 });
      contentScale.value = withTiming(0.9, {
        duration: 160,
        easing: Easing.in(Easing.quad),
      }, (done) => {
        if (done) runOnJS(setMounted)(false);
      });
    }
  }, [visible]);

  const pinch = Gesture.Pinch()
    .onUpdate((e) => {
      pinchScale.value = Math.min(Math.max(savedScale.value * e.scale, 1), 4);
    })
    .onEnd(() => {
      if (pinchScale.value < 1.15) {
        pinchScale.value = withSpring(1, { damping: 15 });
        savedScale.value = 1;
      } else {
        savedScale.value = pinchScale.value;
      }
    });

  const backdropStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({ transform: [{ scale: contentScale.value }] }));
  const pinchStyle = useAnimatedStyle(() => ({ transform: [{ scale: pinchScale.value }] }));
  // Footer fades in with the backdrop but independently of the scale animation
  const footerStyle = useAnimatedStyle(() => ({ opacity: bgOpacity.value }));

  if (!mounted) return null;

  return (
    <Modal visible transparent statusBarTranslucent onRequestClose={onClose}>
      <Animated.View style={[styles.backdrop, backdropStyle]}>

        {/* Tap outside to close */}
        <TouchableOpacity style={StyleSheet.absoluteFill} activeOpacity={1} onPress={onClose} />

        {/* Image + close button — box-none so empty areas pass through to backdrop tap */}
        <Animated.View style={[styles.content, contentStyle]} pointerEvents="box-none">
          <TouchableOpacity
            style={styles.closeBtn}
            onPress={onClose}
            hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
          >
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
          <GestureDetector gesture={pinch}>
            <Animated.View style={[styles.imageContainer, pinchStyle]}>
              <Image
                source={{ uri: stableUrl.current }}
                style={styles.image}
                contentFit="contain"
                transition={120}
              />
            </Animated.View>
          </GestureDetector>
        </Animated.View>

        {/* Footer — sibling rendered AFTER backdrop tap area, highest z-index, always receives touches */}
        {stableFooter.current != null && (
          <Animated.View style={[styles.footerContainer, footerStyle]} pointerEvents="box-none">
            <View pointerEvents="auto">
              {stableFooter.current}
            </View>
          </Animated.View>
        )}

      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.93)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 20,
  },
  closeBtn: {
    position: 'absolute',
    top: 10,
    right: 20,
    backgroundColor: 'rgba(239,68,68,0.9)',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
    elevation: 10,
  },
  closeTxt: { color: 'white', fontWeight: 'bold', fontSize: 20 },
  imageContainer: {
    width,
    height: height * 0.62,
  },
  image: { width: '100%', height: '100%' },
  // Footer is absolutely positioned at the bottom, outside the box-none parent
  footerContainer: {
    position: 'absolute',
    bottom: 52,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
});
