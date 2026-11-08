import React from 'react';
import {
  ScrollView,
  Image,
  StyleSheet,
  View,
  Text,
  Dimensions,
} from 'react-native';
import { borderRadius, spacing } from '../../theme';
import { NoticeItem } from '../../utils/constants';
import { ScalePressable } from '../common/AnimatedComponents';

const { width } = Dimensions.get('window');
const BANNER_WIDTH = Math.min(width * 0.76, 280);
const BANNER_HEIGHT = Math.round(BANNER_WIDTH * (9 / 16)) + 38; // Proporção áurea adaptável com legenda

interface BannerCarouselProps {
  notices: NoticeItem[];
  onPressBanner: (notice: NoticeItem) => void;
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({
  notices,
  onPressBanner,
}) => {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.container}
      decelerationRate="fast"
      snapToInterval={BANNER_WIDTH + spacing.md}
    >
      {notices.map((item) => {
        const imgSource = item.imageUrl ? { uri: item.imageUrl } : item.imageSource;
        return (
          <ScalePressable
            key={item.id}
            onPress={() => onPressBanner(item)}
            style={[styles.bannerWrapper, { width: BANNER_WIDTH, height: BANNER_HEIGHT }]}
          >
            <View style={styles.imageBackgroundWrapper}>
              <Image
                source={imgSource}
                style={styles.bannerImage}
                resizeMode="contain"
              />
            </View>
            <View style={styles.captionOverlay}>
              <Text style={styles.captionCategory} numberOfLines={1}>
                {item.category} • {item.date}
              </Text>
              <Text style={styles.captionTitle} numberOfLines={2}>
                {item.title}
              </Text>
            </View>
          </ScalePressable>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingRight: spacing.lg,
    paddingVertical: spacing.xs,
  },
  bannerWrapper: {
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
    backgroundColor: '#0F172A',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.14,
    shadowRadius: 6,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  imageBackgroundWrapper: {
    flex: 1,
    width: '100%',
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
  captionOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.88)',
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  captionCategory: {
    color: '#34D399',
    fontSize: 10,
    fontWeight: '800',
    marginBottom: 2,
    textTransform: 'uppercase',
  },
  captionTitle: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: '700',
    lineHeight: 16,
  },
});
