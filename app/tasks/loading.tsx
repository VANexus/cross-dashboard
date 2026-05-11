import { Card, CardContent } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-32 skeleton rounded" />
          <div className="h-4 w-48 skeleton rounded" />
        </div>
      </div>
      <div className="flex items-center gap-4">
        <div className="h-9 w-64 skeleton rounded-md" />
        <div className="flex gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-8 w-20 skeleton rounded-md" />
          ))}
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/50">
              <div className="h-2 w-2 skeleton rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-48 skeleton rounded" />
                <div className="h-3 w-64 skeleton rounded" />
              </div>
              <div className="h-5 w-12 skeleton rounded" />
              <div className="h-5 w-16 skeleton rounded" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
