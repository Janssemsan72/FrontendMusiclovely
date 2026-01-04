import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface SystemInfoCardProps {
  title: string;
  icon: React.ReactNode;
  items: {
    label: string;
    value: string | number;
  }[];
}

export default function SystemInfoCard({
  title,
  icon,
  items
}: SystemInfoCardProps) {
  return (
    <Card className="mobile-compact-card">
      <CardHeader className="p-3 md:p-6">
        <div className="flex items-center gap-2">
          <div className="h-4 w-4 md:h-5 md:w-5">{icon}</div>
          <CardTitle className="text-base md:text-lg">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 md:space-y-3 p-3 md:p-6 pt-0">
        {items.map((item, idx) => (
          <div key={idx} className="flex justify-between items-center">
            <span className="text-xs md:text-sm text-muted-foreground">{item.label}</span>
            <span className="text-xs md:text-sm font-semibold">{item.value}</span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
