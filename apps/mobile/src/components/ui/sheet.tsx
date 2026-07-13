import { useEffect, useMemo, useRef, type ReactNode } from "react";
import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetView,
} from "@gorhom/bottom-sheet";
import type { BottomSheetBackdropProps } from "@gorhom/bottom-sheet";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Txt } from "@/components/ui/typography";
import { useTheme } from "@/lib/theme";
import { radii, spacing } from "@/lib/tokens";

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
  const ref = useRef<BottomSheetModal>(null);
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const points = useMemo(
    () => (scrollable ? undefined : (snapPoints ?? ["55%", "86%"])),
    [scrollable, snapPoints],
  );

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={points}
      enableDynamicSizing={scrollable}
      bottomInset={insets.bottom}
      onDismiss={onClose}
      backgroundStyle={{
        backgroundColor: color("card"),
        borderRadius: radii.xl,
      }}
      handleIndicatorStyle={{ backgroundColor: color("mutedForeground") }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          opacity={0.35}
        />
      )}
    >
      {scrollable ? (
        <BottomSheetScrollView
          contentContainerStyle={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
            gap: spacing.md,
          }}
        >
          {title ? <Txt variant="section">{title}</Txt> : null}
          {children}
        </BottomSheetScrollView>
      ) : (
        <BottomSheetView
          style={{
            paddingHorizontal: spacing.lg,
            paddingBottom: spacing.xl,
            gap: spacing.md,
          }}
        >
          {title ? <Txt variant="section">{title}</Txt> : null}
          {children}
        </BottomSheetView>
      )}
    </BottomSheetModal>
  );
}
