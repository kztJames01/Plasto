import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PriceService } from '../services/PriceService';
import { PlasticClass } from '../types/events';

type Props = {
  value: PlasticClass;
  onChange: (value: PlasticClass) => void;
};

const CLASSES: PlasticClass[] = ['A', 'B', 'C'];
const ICONS: Record<PlasticClass, string> = {
  A: '🧴',
  B: '🛍️',
  C: '🧽',
};
const TONES: Record<PlasticClass, { bg: string; border: string }> = {
  A: { bg: '#E9F8ED', border: '#2B974D' },
  B: { bg: '#FFF7E2', border: '#C6911A' },
  C: { bg: '#FFEDEE', border: '#D94A56' },
};

export const ClassSelector: React.FC<Props> = ({ value, onChange }) => (
  <View style={styles.wrap}>
    {CLASSES.map(plasticClass => {
      const selected = value === plasticClass;
      const tone = TONES[plasticClass];
      return (
        <TouchableOpacity
          key={plasticClass}
          style={[
            styles.option,
            selected && styles.optionSelected,
            selected && { backgroundColor: tone.bg, borderColor: tone.border },
          ]}
          onPress={() => onChange(plasticClass)}
        >
          <View style={styles.headRow}>
            <Text style={styles.icon}>{ICONS[plasticClass]}</Text>
            <Text style={[styles.classText, selected && styles.classTextSelected]}>
              Class {plasticClass}
            </Text>
          </View>
          <Text style={[styles.description, selected && styles.descriptionSelected]}>
            {PriceService.classDescription(plasticClass)}
          </Text>
        </TouchableOpacity>
      );
    })}
  </View>
);

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: '#D6D6D6',
    borderRadius: 10,
    padding: 12,
    backgroundColor: '#FFF',
  },
  optionSelected: { borderColor: '#0A7AFF', backgroundColor: '#EAF3FF' },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  icon: { fontSize: 18 },
  classText: { color: '#111', fontWeight: '800', fontSize: 18 },
  classTextSelected: { color: '#0457B8' },
  description: { color: '#555', marginTop: 3, fontSize: 13 },
  descriptionSelected: { color: '#064C97' },
});
