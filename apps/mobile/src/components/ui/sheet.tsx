import { useCallback, useEffect, useMemo, useRef, type ReactNode } from "react";
import { BackHandler, StyleSheet, useWindowDimensions, type LayoutChangeEvent } from "react-native";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SheetInputProvider } from "@/components/ui/sheet-input-context";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";
import { createMediaViewport, MediaViewportContext, MediaVisibleContext } from "@/lib/media-visibility";

type SheetProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  snapPoints?: string[];
  scrollable?: boolean;
};

export function Sheet({
  open,
  onClose,
  title,
  children,
  snapPoints,
  scrollable = false,
}: SheetProps) {
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const modalRef = useRef<BottomSheetModal>(null);
  const mediaViewport = useMemo(createMediaViewport, []);
  useEffect(() => () => mediaViewport.dispose(), [mediaViewport]);
  const handleMediaLayout = useCallback((event: LayoutChangeEvent) => {
    mediaViewport.setViewport(event.currentTarget);
  }, [mediaViewport]);
  const openRef = useRef(open);
  const onCloseRef = useRef(onClose);
  const presentedRef = useRef(false);
  const parentDismissPendingRef = useRef(false);
  const reopenFrameRef = useRef<number | null>(null);
  const stableSnapPoints = useStableSnapPoints(snapPoints);
  const usesFixedSnapPoints = stableSnapPoints !== undefined;
  const maxDynamicContentSize = Math.max(
    0,
    Math.floor((windowHeight - insets.top) * 0.9),
  );
  const contentBottomInset = Math.max(spacing.lg, insets.bottom + spacing.sm);

  openRef.current = open;
  onCloseRef.current = onClose;

  useEffect(() => {
    if (open) {
      // If a parent-driven dismissal is still animating, onDismiss will
      // re-present from the latest controlled value without racing the modal.
      if (parentDismissPendingRef.current) return;
      presentedRef.current = true;
      modalRef.current?.present();
    } else if (presentedRef.current) {
      parentDismissPendingRef.current = true;
      modalRef.current?.dismiss();
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const subscription = BackHandler.addEventListener(
      "hardwareBackPress",
      () => {
        modalRef.current?.dismiss();
        return true;
      },
    );

    return () => subscription.remove();
  }, [open]);

  useEffect(
    () => () => {
      if (reopenFrameRef.current !== null) {
        cancelAnimationFrame(reopenFrameRef.current);
      }
    },
    [],
  );

  const handleDismiss = useCallback(() => {
    presentedRef.current = false;

    if (parentDismissPendingRef.current) {
      parentDismissPendingRef.current = false;
      if (openRef.current) {
        reopenFrameRef.current = requestAnimationFrame(() => {
          reopenFrameRef.current = null;
          if (!openRef.current || presentedRef.current) return;
          presentedRef.current = true;
          modalRef.current?.present();
        });
      }
      return;
    }

    // A user gesture asks the controlled owner to close. Some owners refuse
    // while a mutation is pending, so restore the sheet if `open` stays true.
    if (!openRef.current) return;

    onCloseRef.current();
    reopenFrameRef.current = requestAnimationFrame(() => {
      reopenFrameRef.current = null;
      if (!openRef.current || presentedRef.current) return;
      presentedRef.current = true;
      modalRef.current?.present();
    });
  }, []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        accessibilityHint="Closes the sheet"
        accessibilityLabel={title ? `Close ${title}` : "Close sheet"}
        accessibilityRole="button"
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.45}
        pressBehavior="close"
      />
    ),
    [title],
  );

  const content = (
    <SheetInputProvider>
      {title ? (
        <Txt
          accessibilityRole="header"
          numberOfLines={2}
          variant="section"
          style={styles.title}
        >
          {title}
        </Txt>
      ) : null}
      {children}
    </SheetInputProvider>
  );
  const contentStyle = useMemo(
    () => [
      styles.content,
      {
        paddingBottom: contentBottomInset,
      },
    ],
    [contentBottomInset],
  );

  return (
    <MediaViewportContext.Provider value={mediaViewport}>
    <MediaVisibleContext.Provider value={open}>
    <BottomSheetModal
      ref={modalRef}
      accessible={false}
      accessibilityLabel={null}
      accessibilityRole={null}
      animateOnMount
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: color("card"),
        borderColor: color("border"),
        borderRadius: 0,
        borderTopLeftRadius: radii.xl,
        borderTopRightRadius: radii.xl,
        borderTopWidth: StyleSheet.hairlineWidth,
      }}
      enableBlurKeyboardOnGesture
      enableDynamicSizing={!usesFixedSnapPoints}
      enablePanDownToClose
      handleIndicatorStyle={{
        width: 32,
        height: 4,
        backgroundColor: color("border"),
      }}
      handleStyle={styles.handle}
      index={0}
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      maxDynamicContentSize={maxDynamicContentSize}
      snapPoints={stableSnapPoints}
      topInset={insets.top}
      onDismiss={handleDismiss}
      onChange={mediaViewport.check}
    >
      {scrollable ? (
        <BottomSheetScrollView
          onLayout={handleMediaLayout}
          onScroll={mediaViewport.check}
          accessibilityViewIsModal
          contentContainerStyle={contentStyle}
          keyboardDismissMode="interactive"
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {content}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView onLayout={handleMediaLayout} accessibilityViewIsModal style={contentStyle}>
          {content}
        </BottomSheetView>
      )}
    </BottomSheetModal>
    </MediaVisibleContext.Provider>
    </MediaViewportContext.Provider>
  );
}

function useStableSnapPoints(snapPoints: string[] | undefined) {
  const key = snapPoints?.join("\u0000") ?? null;
  const stableRef = useRef<{
    key: string | null;
    value: string[] | undefined;
  }>({ key, value: snapPoints ? [...snapPoints] : undefined });

  if (stableRef.current.key !== key) {
    stableRef.current = {
      key,
      value: snapPoints ? [...snapPoints] : undefined,
    };
  }

  return stableRef.current.value;
}

const styles = StyleSheet.create({
  handle: {
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  content: {
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.xs,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    lineHeight: 21,
    paddingBottom: spacing.xs,
  },
});
