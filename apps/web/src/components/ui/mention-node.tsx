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
import { Avatar, AvatarFallback, AvatarImage } from './avatar';
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
  avatarUrl?: string | null;
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
    <MentionablesContext.Provider value={items}>
      {children}
    </MentionablesContext.Provider>
  );
}

export function MentionElement(
  props: PlateElementProps<TMentionElement> & {
    prefix?: string;
  },
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
        'inline-block translate-y-[-1px] rounded-md bg-primary/10 px-2 py-0.5 align-baseline text-sm font-medium text-primary mx-0.5',
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
  props: PlateElementProps<TComboboxInputElement>,
) {
  const { editor, element } = props;
  const [search, setSearch] = React.useState('');
  const items = React.useContext(MentionablesContext);
  const visibleItems = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    const matches = query
      ? items.filter((item) =>
          [
            item.key,
            item.text,
            item.label,
            item.detail,
            ...(item.keywords ?? []),
          ]
            .filter(Boolean)
            .some((value) => value!.toLowerCase().includes(query)),
        )
      : items;
    return matches.slice(0, 12);
  }, [items, search]);

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox
        value={search}
        element={element}
        setValue={setSearch}
        showTrigger={false}
        trigger="@"
      >
        <span className="mx-0.5 inline-block translate-y-[-1px] rounded-md bg-primary/10 px-2 py-0.5 align-baseline text-sm text-primary ring-ring focus-within:ring-2">
          <InlineComboboxInput className="min-w-12" />
        </span>

        <InlineComboboxContent
          className={cn(
            'my-2 max-h-60 w-56',
            'rounded-xl border-0 bg-surface-3 p-1 shadow-surface-3',
          )}
        >
          <InlineComboboxEmpty className="px-2 py-1.5 text-sm text-muted-foreground">
            No matches found.
          </InlineComboboxEmpty>

          {['person', 'group'].map((section) => {
            const entries = visibleItems.filter((item) =>
              section === 'person'
                ? item.kind === 'person'
                : item.kind !== 'person',
            );
            if (!entries.length) return null;
            return (
              <InlineComboboxGroup key={section}>
                {visibleItems.some((item) => item.kind === 'person') &&
                visibleItems.some((item) => item.kind !== 'person') ? (
                  <p className="px-2 py-1 text-xs text-muted-foreground">
                    {section === 'person' ? 'People' : 'Groups'}
                  </p>
                ) : null}
                {entries.map((item) => (
                  <InlineComboboxItem
                    key={item.key}
                    value={item.text}
                    label={item.label}
                    keywords={item.keywords}
                    onClick={() => onSelectItem(editor, item, search)}
                  >
                    {item.kind === 'person' ? (
                      <Avatar className="size-5">
                        <AvatarImage src={item.avatarUrl ?? undefined} />
                        <AvatarFallback className="text-[9px]">
                          {(item.label ?? item.text)
                            .split(' ')
                            .map((name) => name[0])
                            .slice(0, 2)
                            .join('')}
                        </AvatarFallback>
                      </Avatar>
                    ) : null}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">
                        {item.label ?? item.text}
                      </span>
                      {item.detail ? (
                        <span className="block truncate text-xs text-muted-foreground">
                          {item.detail}
                        </span>
                      ) : null}
                    </span>
                  </InlineComboboxItem>
                ))}
              </InlineComboboxGroup>
            );
          })}
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
