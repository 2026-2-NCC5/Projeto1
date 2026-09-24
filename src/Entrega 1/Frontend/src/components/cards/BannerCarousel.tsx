import React from 'react';
import {
  ScrollView,
  TouchableOpacity,
  Image,
  StyleSheet,
  View,
} from 'react-native';
import { borderRadius, spacing } from '../../theme';
import { NoticeItem } from '../../utils/constants';

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
      snapToInterval={180 + spacing.md}
    >
      {notices.map((item) => (
        <TouchableOpacity
          key={item.id}
          activeOpacity={0.9}
          onPress={() => onPressBanner(item)}
          style={styles.bannerWrapper}
        >
          <Image
            source={item.imageSource}
            style={styles.bannerImage}
            resizeMode="cover"
          />
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingRight: spacing.lg,
    paddingVertical: spacing.xs,
  },
  bannerWrapper: {
    width: 175,
    height: 180,
    borderRadius: borderRadius.lg,
    overflow: 'hidden',
    marginRight: spacing.md,
    backgroundColor: '#F3F4F6',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  bannerImage: {
    width: '100%',
    height: '100%',
  },
});
