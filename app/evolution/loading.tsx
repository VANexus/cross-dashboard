import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <div className="h-7 w-28 skeleton rounded" />
          <div className="h-4 w-56 skeleton rounded" />
        </div>
      </div>
      <div className="grid gap-6 grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-3 w-20 skeleton rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-7 w-16 skeleton rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-4 w-20 skeleton rounded" />
        </CardHeader>
        <CardContent>
          <div className="h-16 w-full skeleton rounded" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-4 w-24 skeleton rounded" />
        </CardHeader>
        <CardContent className="p-0">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 w-full skeleton" />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
