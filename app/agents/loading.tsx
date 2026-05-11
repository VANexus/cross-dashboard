import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-32 skeleton rounded" />
          <div className="h-4 w-48 skeleton rounded" />
        </div>
        <div className="flex gap-2">
          <div className="h-8 w-24 skeleton rounded-md" />
          <div className="h-8 w-28 skeleton rounded-md" />
        </div>
      </div>
      <div className="grid gap-4 grid-cols-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 skeleton rounded-lg" />
                  <div className="space-y-1">
                    <div className="h-4 w-24 skeleton rounded" />
                    <div className="h-3 w-16 skeleton rounded" />
                  </div>
                </div>
                <div className="h-5 w-12 skeleton rounded" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="h-3 w-full skeleton rounded" />
              <div className="h-3 w-3/4 skeleton rounded" />
              <div className="flex gap-1">
                <div className="h-4 w-16 skeleton rounded" />
                <div className="h-4 w-20 skeleton rounded" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
