'use client';

import * as React from 'react';
import type { TComboboxInputElement, TMentionElement } from 'platejs';
import type { PlateElementProps } from 'platejs/react';
import { getMentionOnSelectItem } from '@platejs/mention';
import { IS_APPLE, KEYS } from 'platejs';
import {
  PlateElement,
  useFocused,
  useReadOnly,
  useSelected,
} from 'platejs/react';
import { cn } from '@/lib/utils';
import { useMounted } from '@/hooks/use-mounted';
import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxInput,
  InlineComboboxItem,
} from './inline-combobox';

export type MentionableItem = {
  key: string;
  text: string;
  label?: string;
  detail?: string;
  keywords?: string[];
  kind?: string;
};

const MentionablesContext = React.createContext<MentionableItem[]>([]);

export function MentionablesProvider({
  items,
  children,
}: {
  items: MentionableItem[];
  children: React.ReactNode;
}) {
  return (
    <MentionablesContext.Provider value={items}>{children}</MentionablesContext.Provider>
  );
}

export function MentionElement(
  props: PlateElementProps<TMentionElement> & {
    prefix?: string;
  }
) {
  const { prefix = '@' } = props;
  const element = props.element;
  const selected = useSelected();
  const focused = useFocused();
  const mounted = useMounted();
  const readOnly = useReadOnly();

  return (
    <PlateElement
      {...props}
      className={cn(
        'inline-block rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline text-sm font-medium text-primary',
        !readOnly && 'cursor-pointer',
        selected && focused && 'ring-2 ring-ring',
        element.children[0][KEYS.bold] === true && 'font-bold',
        element.children[0][KEYS.italic] === true && 'italic',
        element.children[0][KEYS.underline] === true && 'underline',
      )}
      attributes={{
        ...props.attributes,
        contentEditable: false,
        'data-slate-value': element.value,
        draggable: true,
      }}
    >
      {mounted && IS_APPLE ? (
        <>
          {props.children}
          {prefix}
          {element.value}
        </>
      ) : (
        <>
          {prefix}
          {element.value}
          {props.children}
        </>
      )}
    </PlateElement>
  );
}

const onSelectItem = getMentionOnSelectItem();

export function MentionInputElement(
  props: PlateElementProps<TComboboxInputElement>
) {
  const { editor, element } = props;
  const [search, setSearch] = React.useState('');
  const items = React.useContext(MentionablesContext);

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        value={search}
        element={element}
        setValue={setSearch}
        showTrigger={false}
        trigger="@"
      >
        <span className="inline-block rounded-md bg-primary/10 px-1.5 py-0.5 align-baseline text-sm text-primary ring-ring focus-within:ring-2">
          <InlineComboboxInput className="min-w-12" />
        </span>

        <InlineComboboxContent className="my-2 w-80 rounded-xl border border-border bg-popover p-1 shadow-lg">
          <InlineComboboxEmpty className="px-3 py-2 text-sm text-muted-foreground">
            No matches found.
          </InlineComboboxEmpty>

          <InlineComboboxGroup>
            {items.map((item) => (
              <InlineComboboxItem
                key={item.key}
                value={item.text}
                label={item.label}
                keywords={item.keywords}
                onClick={() => onSelectItem(editor, item, search)}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">@{item.text}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.label}
                    {item.detail ? ` · ${item.detail}` : ''}
                  </p>
                </div>
                {item.kind ? (
                  <span className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                    {item.kind}
                  </span>
                ) : null}
              </InlineComboboxItem>
            ))}
          </InlineComboboxGroup>
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
