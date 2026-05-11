import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-24 skeleton rounded" />
          <div className="h-4 w-48 skeleton rounded" />
        </div>
      </div>
      <div className="grid gap-6 grid-cols-3">
        <Card className="col-span-1">
          <CardHeader className="pb-2">
            <div className="h-4 w-20 skeleton rounded" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <div className="h-24 w-24 skeleton rounded-full" />
              <div className="flex-1 space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="h-3 w-full skeleton rounded" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="col-span-2">
          <CardHeader className="pb-2">
            <div className="h-4 w-20 skeleton rounded" />
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="h-12 skeleton rounded-lg" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6 grid-cols-[1fr_320px]">
        <Card>
          <CardHeader className="pb-3">
            <div className="h-4 w-20 skeleton rounded" />
          </CardHeader>
          <CardContent className="p-0">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-14 w-full skeleton" />
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="h-4 w-24 skeleton rounded" />
          </CardHeader>
          <CardContent className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-8 w-full skeleton rounded" />
            ))}
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-4 w-28 skeleton rounded" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-10 skeleton rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
