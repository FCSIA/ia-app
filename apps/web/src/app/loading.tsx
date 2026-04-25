export default function Loading() {
  return (
    <div className="flex flex-1 items-center justify-center p-8 min-h-[50vh]">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm font-medium animate-pulse">Loading...</p>
      </div>
    </div>
  );
}
