import { Card, CardContent, CardHeader } from "@/components/ui/card";

export default function Loading() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <div className="h-8 w-16 skeleton rounded-md" />
        <div className="flex-1 space-y-1">
          <div className="h-7 w-64 skeleton rounded" />
          <div className="h-4 w-48 skeleton rounded" />
        </div>
      </div>
      <div className="grid gap-6 grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="h-3 w-16 skeleton rounded" />
            </CardHeader>
            <CardContent>
              <div className="h-5 w-20 skeleton rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3">
          <div className="h-4 w-24 skeleton rounded" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="h-8 w-8 skeleton rounded-full" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-32 skeleton rounded" />
                <div className="h-3 w-48 skeleton rounded" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
