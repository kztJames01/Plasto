import React from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { CapturedPhoto } from '../services/PhotoCaptureService';

type Props = {
  photos: Array<CapturedPhoto | null>;
  onCapture: (index: number) => void;
};

export const PhotoReviewStrip: React.FC<Props> = ({ photos, onCapture }) => {
  return (
    <View style={styles.row}>
      {photos.map((p, i) => (
        <TouchableOpacity
          key={i}
          style={styles.box}
          onPress={() => onCapture(i)}
        >
          {p?.uri ? (
            <Image source={{ uri: p.uri }} style={styles.img} />
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>Photo {i + 1}</Text>
            </View>
          )}
          <Text style={styles.action}>{p ? 'Retake' : 'Capture'}</Text>
        </TouchableOpacity>
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 8,
    marginBottom: 8,
  },
  box: {
    flex: 1,
    backgroundColor: '#FFF',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 6,
    alignItems: 'center',
  },
  img: {
    width: '100%',
    height: 72,
    borderRadius: 8,
    backgroundColor: '#EEE',
  },
  empty: {
    width: '100%',
    height: 72,
    borderRadius: 8,
    backgroundColor: '#F0F0F0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  emptyText: { color: '#666', fontSize: 12 },
  action: { marginTop: 6, color: '#0A7AFF', fontWeight: '700', fontSize: 12 },
});
