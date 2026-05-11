import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="data-grid grid-cols-2 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex flex-col gap-1 p-4">
            <div className="h-3 w-20 skeleton rounded" />
            <div className="h-7 w-16 skeleton rounded mt-1" />
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader className="pb-3">
            <div className="h-4 w-28 skeleton rounded" />
          </CardHeader>
          <CardContent className="p-0">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50">
                <div className="h-2 w-2 skeleton rounded-full" />
                <div className="h-4 w-4 skeleton rounded" />
                <div className="h-4 w-24 skeleton rounded flex-1" />
                <div className="h-3 w-16 skeleton rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="h-4 w-24 skeleton rounded" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <div className="h-2 w-2 skeleton rounded-full" />
                <div className="h-4 w-16 skeleton rounded flex-1" />
                <div className="h-4 w-12 skeleton rounded" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="h-4 w-24 skeleton rounded" />
        </CardHeader>
        <CardContent className="p-0">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-border/50">
              <div className="h-2 w-2 skeleton rounded-full" />
              <div className="h-4 flex-1 skeleton rounded" />
              <div className="h-3 w-16 skeleton rounded" />
            </div>
          ))}
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-3 w-24 skeleton rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-20 skeleton rounded mb-2" />
              <div className="h-3 w-28 skeleton rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
