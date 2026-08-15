"use client";

import { IaQrCode } from "@/components/ui/ia-qr-code";

export function FriendLinkQr({ value }: { value: string }) {
  return <IaQrCode value={value} label="Friend link QR code" />;
}
