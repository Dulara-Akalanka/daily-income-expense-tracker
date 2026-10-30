import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { memo, useMemo, type ComponentProps } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Text, useTheme } from 'react-native-paper';

import type { Category, CategoryNode } from '@/db/types';

type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

interface CategoryChipsProps {
  categories: CategoryNode[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

/**
 * Two rows of quick-pick chips: parents on top, and the children of the
 * active parent underneath. Picking a parent alone is a valid selection.
 */
export const CategoryChips = memo(function CategoryChips({ categories, selectedId, onSelect }: CategoryChipsProps) {
  const activeParent = useMemo(
    () =>
      categories.find(
        (parent) => parent.id === selectedId || parent.children.some((child) => child.id === selectedId),
      ) ?? null,
    [categories, selectedId],
  );

  return (
    <View style={styles.container}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {categories.map((parent) => (
          <Chip
            key={parent.id}
            category={parent}
            selected={parent.id === activeParent?.id}
            onPress={() => onSelect(parent.id)}
          />
        ))}
      </ScrollView>

      {activeParent && activeParent.children.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
          {activeParent.children.map((child) => (
            <Chip
              key={child.id}
              category={child}
              selected={child.id === selectedId}
              onPress={() => onSelect(child.id)}
              compact
            />
          ))}
        </ScrollView>
      )}
    </View>
  );
});

interface ChipProps {
  category: Category;
  selected: boolean;
  onPress: () => void;
  compact?: boolean;
}

function Chip({ category, selected, onPress, compact = false }: ChipProps) {
  const theme = useTheme();
  const foreground = selected ? '#FFFFFF' : category.color;

  return (
    <Pressable
      onPress={() => {
        void Haptics.selectionAsync();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={category.name}
      style={[
        styles.chip,
        compact && styles.chipCompact,
        {
          // "1F" ≈ 12% alpha tint of the category colour.
          backgroundColor: selected ? category.color : `${category.color}1F`,
          borderColor: selected ? category.color : 'transparent',
        },
      ]}
    >
      <MaterialCommunityIcons name={category.icon as IconName} size={compact ? 16 : 18} color={foreground} />
      <Text
        variant={compact ? 'labelMedium' : 'labelLarge'}
        style={{ color: selected ? '#FFFFFF' : theme.colors.onSurface }}
      >
        {category.name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 8,
  },
  row: {
    gap: 8,
    paddingHorizontal: 16,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
  },
  chipCompact: {
    paddingHorizontal: 12,
    height: 32,
    borderRadius: 16,
  },
});
