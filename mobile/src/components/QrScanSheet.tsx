import React from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { Camera, CameraType } from 'react-native-camera-kit';

type Props = {
  visible: boolean;
  onClose: () => void;
  onScanned: (value: string) => void;
};

export const QrScanSheet: React.FC<Props> = ({ visible, onClose, onScanned }) => {
  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.root}>
        <Text style={styles.title}>Scan QR frame</Text>
        <Text style={styles.sub}>Move camera slowly frame by frame</Text>
        <View style={styles.camWrap}>
          <Camera
            style={styles.cam}
            cameraType={CameraType.Back}
            scanBarcode
            showFrame
            onReadCode={e => onScanned(e.nativeEvent.codeStringValue)}
          />
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
          <Text style={styles.closeText}>Close scanner</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#111', paddingTop: 56, paddingHorizontal: 16 },
  title: { color: '#FFF', fontSize: 24, fontWeight: '800' },
  sub: { color: '#BBB', marginTop: 6 },
  camWrap: {
    flex: 1,
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  cam: { flex: 1 },
  closeBtn: {
    backgroundColor: '#0A7AFF',
    borderRadius: 10,
    marginVertical: 16,
    alignItems: 'center',
    paddingVertical: 14,
  },
  closeText: { color: '#FFF', fontWeight: '800', fontSize: 16 },
});
