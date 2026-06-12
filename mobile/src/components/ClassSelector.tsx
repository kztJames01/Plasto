import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { PriceService } from '../services/PriceService';
import { PlasticClass } from '../types/events';

type Props = {
  value: PlasticClass;
  onChange: (value: PlasticClass) => void;
};

const CLASSES: PlasticClass[] = ['A', 'B', 'C'];

export const ClassSelector: React.FC<Props> = ({ value, onChange }) => (
  <View style={styles.wrap}>
    {CLASSES.map(plasticClass => {
      const selected = value === plasticClass;
      return (
        <TouchableOpacity
          key={plasticClass}
          style={[styles.option, selected && styles.optionSelected]}
          onPress={() => onChange(plasticClass)}
        >
          <Text style={[styles.classText, selected && styles.classTextSelected]}>
            {plasticClass}
          </Text>
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
  classText: { color: '#111', fontWeight: '800', fontSize: 18 },
  classTextSelected: { color: '#0457B8' },
  description: { color: '#555', marginTop: 3, fontSize: 13 },
  descriptionSelected: { color: '#064C97' },
});
