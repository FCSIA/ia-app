'use client';

import { Plus } from 'lucide-react';
import { SchoolDayBlockFormCard } from '@/components/schedule/school-day-block-form-card';
import {
  WEEKDAYS,
  formatDuration,
  getBlocksForDay,
} from '@/components/schedule/schedule-utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { TabPanel } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { useScheduleWorkspace } from './ScheduleWorkspaceProvider';

export function ManageBlocksPanel() {
  const {
    adminWeekday,
    blocks,
    createBlock,
    creatingDay,
    deleteBlock,
    editingBlockId,
    pendingAction,
    runScheduleAction,
    setAdminWeekday,
    setCreatingDay,
    setEditingBlockId,
    updateBlock,
    isBulkEditing,
    draftAdminBlocks: draftBlocks,
    setDraftAdminBlocks: setDraftBlocks,
    handleBulkSaveAdminBlocks: handleBulkSave,
  } = useScheduleWorkspace();
  
  const weekdayBlocks = getBlocksForDay(blocks, adminWeekday);

  return (
    <TabPanel value="admin" className="mt-6">
      <div className="flex items-center gap-1 border-b border-border/30">
        {WEEKDAYS.map((day) => (
          <button
            key={day.value}
            type="button"
            onClick={() => setAdminWeekday(day.value)}
            className={cn(
              '-mb-px border-b-2 px-4 py-2 text-sm font-medium transition-colors',
              adminWeekday === day.value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground',
            )}
          >
            {day.shortLabel}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-4 mb-1">
          <Button
            size="sm"
            className="h-7 text-xs"
            onClick={() => {
              setCreatingDay(adminWeekday);
              setEditingBlockId(null);
              if (isBulkEditing) handleBulkSave();
            }}
          >
            <Plus className="mr-1.5 size-3" />
            Add block
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-4">
        {creatingDay === adminWeekday ? (
          <SchoolDayBlockFormCard
            weekday={adminWeekday}
            title="New block"
            submitLabel={pendingAction === 'block-create' ? 'Creating…' : 'Create'}
            submitIcon="plus"
            onSubmit={(payload) =>
              void runScheduleAction(
                'block-create',
                async () => {
                  await createBlock(payload);
                  setCreatingDay(null);
                },
                'Block created',
              )
            }
            onCancel={() => setCreatingDay(null)}
            isPending={pendingAction === 'block-create'}
          />
        ) : null}

        {weekdayBlocks.length > 0 ? (
          <div className="divide-y divide-border/30">
            {weekdayBlocks.map((block) => {
              if (isBulkEditing) {
                const draft = draftBlocks[block.id] || block;
                return (
                  <div key={block.id} className="group flex items-center justify-between gap-4 py-3">
                    <div className="flex flex-1 items-center gap-3">
                      <Input
                        value={draft.periodNumber ? `Period ${draft.periodNumber}` : draft.label}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (draft.periodNumber && val.toLowerCase().startsWith('period ')) {
                            const num = parseInt(val.replace(/[^0-9]/g, ''));
                            setDraftBlocks(prev => ({ ...prev, [block.id]: { ...draft, periodNumber: isNaN(num) ? draft.periodNumber : num } }));
                          } else {
                            setDraftBlocks(prev => ({ ...prev, [block.id]: { ...draft, periodNumber: null, label: val } }));
                          }
                        }}
                        className="h-8 w-full max-w-[200px] text-sm font-medium bg-muted/20 border-border/50"
                        placeholder="Label"
                      />
                      
                      <div className="flex items-center gap-2">
                        <Input
                          type="time"
                          value={draft.startTime}
                          onChange={(e) => setDraftBlocks(prev => ({ ...prev, [block.id]: { ...draft, startTime: e.target.value } }))}
                          className="h-8 w-[130px] text-xs bg-muted/20 border-border/50"
                        />
                        <span className="text-xs text-muted-foreground">–</span>
                        <Input
                          type="time"
                          value={draft.endTime}
                          onChange={(e) => setDraftBlocks(prev => ({ ...prev, [block.id]: { ...draft, endTime: e.target.value } }))}
                          className="h-8 w-[130px] text-xs bg-muted/20 border-border/50"
                        />
                      </div>
                    </div>
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs text-destructive opacity-0 transition-opacity hover:text-destructive hover:bg-destructive/10 group-hover:opacity-100"
                      onClick={(event) => {
                        event.stopPropagation();
                        void runScheduleAction(
                          `block-delete:${block.id}`,
                          () => deleteBlock({ blockId: block.id }),
                          'Block removed',
                        );
                      }}
                    >
                      Delete
                    </Button>
                  </div>
                );
              }

              return editingBlockId === block.id ? (
                <SchoolDayBlockFormCard
                  key={block.id}
                  weekday={adminWeekday}
                  block={block}
                  title={`Edit ${block.label}`}
                  submitLabel={pendingAction === `block-update:${block.id}` ? 'Saving…' : 'Save'}
                  onSubmit={(payload) =>
                    void runScheduleAction(
                      `block-update:${block.id}`,
                      async () => {
                        await updateBlock({ blockId: block.id, ...payload });
                        setEditingBlockId(null);
                      },
                      'Block updated',
                    )
                  }
                  onDelete={() =>
                    void runScheduleAction(
                      `block-delete:${block.id}`,
                      async () => {
                        await deleteBlock({ blockId: block.id });
                        setEditingBlockId(null);
                      },
                      'Block removed',
                    )
                  }
                  onCancel={() => setEditingBlockId(null)}
                  isPending={pendingAction === `block-update:${block.id}`}
                  isDeleting={pendingAction === `block-delete:${block.id}`}
                />
              ) : (
                <div
                  key={block.id}
                  className="group flex cursor-pointer items-center justify-between gap-4 py-3"
                  onClick={() => {
                    setEditingBlockId(block.id);
                    setCreatingDay(null);
                  }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="text-sm font-medium text-foreground">{block.label}</span>
                    <span className="text-xs text-muted-foreground">
                      {block.startTime} – {block.endTime}
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {formatDuration(block.durationMinutes)}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[10px] text-destructive opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                    onClick={(event) => {
                      event.stopPropagation();
                      void runScheduleAction(
                        `block-delete:${block.id}`,
                        () => deleteBlock({ blockId: block.id }),
                        'Block removed',
                      );
                    }}
                  >
                    Delete
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No blocks for this day yet.
          </p>
        )}
      </div>
    </TabPanel>
  );
}
