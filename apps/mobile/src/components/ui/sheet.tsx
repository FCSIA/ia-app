import { useEffect, useMemo, useRef, type ReactNode } from "react";
import { BottomSheetBackdrop, BottomSheetModal, BottomSheetView } from "@gorhom/bottom-sheet";
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
};

export function Sheet({ open, onClose, title, children, snapPoints }: SheetProps) {
  const ref = useRef<BottomSheetModal>(null);
  const { color } = useTheme();
  const insets = useSafeAreaInsets();
  const points = useMemo(() => snapPoints ?? ["55%", "86%"], [snapPoints]);

  useEffect(() => {
    if (open) ref.current?.present();
    else ref.current?.dismiss();
  }, [open]);

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={points}
      bottomInset={insets.bottom}
      onDismiss={onClose}
      backgroundStyle={{ backgroundColor: color("card"), borderRadius: radii.xl }}
      handleIndicatorStyle={{ backgroundColor: color("mutedForeground") }}
      backdropComponent={(props: BottomSheetBackdropProps) => (
        <BottomSheetBackdrop {...props} appearsOnIndex={0} disappearsOnIndex={-1} opacity={0.35} />
      )}
    >
      <BottomSheetView style={{ paddingHorizontal: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md }}>
        {title ? <Txt variant="section">{title}</Txt> : null}
        {children}
      </BottomSheetView>
    </BottomSheetModal>
  );
}
