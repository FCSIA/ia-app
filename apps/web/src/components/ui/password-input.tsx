'use client';

import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import {
  InputControl,
  InputControlAddon,
  InputControlButton,
  InputControlInput,
} from '@/components/ui/input-control-group';

type PasswordInputProps = Omit<ComponentProps<'input'>, 'type'>;

export function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <InputControl>
      <InputControlInput {...props} type={visible ? 'text' : 'password'} />
      <InputControlAddon align="inline-end">
        <InputControlButton
          type="button"
          variant="ghost"
          size="icon-xs"
          aria-label={visible ? 'Hide password' : 'Show password'}
          title={visible ? 'Hide password' : 'Show password'}
          aria-pressed={visible}
          onClick={() => setVisible((current) => !current)}
        >
          {visible ? <EyeOff aria-hidden /> : <Eye aria-hidden />}
        </InputControlButton>
      </InputControlAddon>
    </InputControl>
  );
}
