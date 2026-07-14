"use client";

import { useCallback, useId, useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { Upload } from "lucide-react";
import { Button, type ButtonProps } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FileInputRenderProps = {
  disabled: boolean;
  inputId: string;
  open: () => void;
};

type FileInputProps = Omit<
  ComponentPropsWithoutRef<"input">,
  "children" | "className" | "onChange" | "type"
> & {
  buttonClassName?: string;
  buttonSize?: ButtonProps["size"];
  buttonVariant?: ButtonProps["variant"];
  children?: (props: FileInputRenderProps) => ReactNode;
  label?: string;
  loading?: boolean;
  onFileSelect: (file: File) => void;
};

export function FileInput({
  buttonClassName,
  buttonSize = "sm",
  buttonVariant = "tertiary",
  children,
  disabled = false,
  id,
  label = "Upload file",
  loading = false,
  onFileSelect,
  ...inputProps
}: FileInputProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const isDisabled = disabled || loading;

  const open = useCallback(() => {
    if (!isDisabled) inputRef.current?.click();
  }, [isDisabled]);

  return (
    <>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        disabled={isDisabled}
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) onFileSelect(file);
          event.target.value = "";
        }}
        {...inputProps}
      />
      {children ? (
        children({ disabled: isDisabled, inputId, open })
      ) : (
        <Button
          type="button"
          size={buttonSize}
          variant={buttonVariant}
          loading={loading}
          disabled={isDisabled}
          onClick={open}
          className={cn("rounded-full", buttonClassName)}
        >
          <Upload className="size-4" />
          {label}
        </Button>
      )}
    </>
  );
}
