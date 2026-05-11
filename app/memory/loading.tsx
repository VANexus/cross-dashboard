import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-24 skeleton rounded" />
          <div className="h-4 w-48 skeleton rounded" />
        </div>
        <div className="h-8 w-24 skeleton rounded-md" />
      </div>
      <div className="grid gap-6 grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-3 w-16 skeleton rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-12 skeleton rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <div className="h-9 w-64 skeleton rounded-md" />
        <div className="flex gap-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 w-16 skeleton rounded-md" />
          ))}
        </div>
      </div>
      <div className="grid gap-6 grid-cols-[1fr_320px]">
        <Card>
          <CardContent className="p-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-16 w-full skeleton" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="h-4 w-20 skeleton rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-10 w-full skeleton rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
