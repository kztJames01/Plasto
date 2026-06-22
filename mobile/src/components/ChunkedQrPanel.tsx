import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import QRCode from 'react-native-qrcode-svg';

type Props = {
  title: string;
  packets: string[];
};

export const ChunkedQrPanel: React.FC<Props> = ({ title, packets }) => {
  const [idx, setIdx] = useState(0);
  const safeIdx = Math.max(0, Math.min(idx, packets.length - 1));
  const packet = packets[safeIdx] ?? '';
  const all = useMemo(() => packets.join('\n'), [packets]);

  if (packets.length === 0) {
    return null;
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.page}>Frame {safeIdx + 1}/{packets.length}</Text>
      <View style={styles.qrBox}>
        <QRCode value={packet} ecl="H" size={220} />
      </View>
      <View style={styles.nav}>
        <TouchableOpacity
          style={styles.btn}
          disabled={safeIdx <= 0}
          onPress={() => setIdx(v => Math.max(0, v - 1))}
        >
          <Text style={styles.btnText}>Prev</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.btn}
          disabled={safeIdx >= packets.length - 1}
          onPress={() => setIdx(v => Math.min(packets.length - 1, v + 1))}
        >
          <Text style={styles.btnText}>Next</Text>
        </TouchableOpacity>
      </View>
      <Text style={styles.label}>Copy fallback (all frames)</Text>
      <TextInput value={all} editable={false} multiline style={styles.code} selectTextOnFocus />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { marginTop: 14, backgroundColor: '#FFF', borderRadius: 12, padding: 12 },
  title: { fontSize: 16, fontWeight: '800', color: '#111' },
  page: { marginTop: 4, color: '#666' },
  qrBox: { marginTop: 10, alignItems: 'center', paddingVertical: 6 },
  nav: { flexDirection: 'row', justifyContent: 'center', gap: 10, marginTop: 8 },
  btn: { backgroundColor: '#0A7AFF', paddingHorizontal: 14, paddingVertical: 10, borderRadius: 8 },
  btnText: { color: '#FFF', fontWeight: '700' },
  label: { marginTop: 12, marginBottom: 6, color: '#333', fontWeight: '700' },
  code: {
    minHeight: 100,
    backgroundColor: '#111',
    color: '#FFF',
    borderRadius: 10,
    padding: 10,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    fontSize: 11,
  },
});
