import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

interface Props {
  publicKeyBase58: string;
  size?: number;
}

function generateIdenticonColor(publicKey: string): string {
  let hash = 0;
  for (let i = 0; i < publicKey.length; i++) {
    const char = publicKey.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const hue = Math.abs(hash % 360);
  return `hsl(${hue}, 70%, 50%)`;
}

export const QRDisplay: React.FC<Props> = ({ publicKeyBase58, size = 200 }) => {
  const identiconColor = generateIdenticonColor(publicKeyBase58);

  return (
    <View style={styles.container}>
      <View style={[styles.identicon, { backgroundColor: identiconColor }]} />
      <View style={styles.qrContainer}>
        <QRCode value={publicKeyBase58} size={size} />
      </View>
      <Text style={styles.publicKeyText} numberOfLines={2} ellipsizeMode="middle">
        {publicKeyBase58}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    padding: 20,
  },
  identicon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginBottom: 16,
  },
  qrContainer: {
    padding: 16,
    backgroundColor: '#fff',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  publicKeyText: {
    marginTop: 16,
    fontSize: 14,
    fontFamily: 'monospace',
    color: '#555',
    maxWidth: 280,
  },
});
