import { Users, Clock, AlertTriangle, LogOut } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface AttendanceSummaryProps {
  totalRecords: number;
  totalHours: number;
  lateCount: number;
  earlyCount: number;
  presentCount?: number;
  absentCount?: number;
}

export function AttendanceSummary({
  totalRecords,
  totalHours,
  lateCount,
  earlyCount,
  presentCount,
  absentCount,
}: AttendanceSummaryProps) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Users className="w-4 h-4 text-slate-500" />
            Records
          </CardDescription>
          <CardTitle className="text-2xl">{totalRecords}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Total clock-in/out entries
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-500" />
            Total Hours
          </CardDescription>
          <CardTitle className="text-2xl">{totalHours.toFixed(1)}h</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Sum of worked hours
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" />
            Late Arrivals
          </CardDescription>
          <CardTitle className="text-2xl text-amber-600">{lateCount}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Clock-in after shift start
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardDescription className="flex items-center gap-2">
            <LogOut className="w-4 h-4 text-orange-500" />
            Early Leaves
          </CardDescription>
          <CardTitle className="text-2xl text-orange-600">{earlyCount}</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground">
          Clock-out before shift end
        </CardContent>
      </Card>

      {presentCount !== undefined && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500" />
              Present
            </CardDescription>
            <CardTitle className="text-2xl text-green-600">{presentCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            Full day attendance
          </CardContent>
        </Card>
      )}

      {absentCount !== undefined && (
        <Card>
          <CardHeader className="pb-2">
            <CardDescription className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-red-500" />
              Absent
            </CardDescription>
            <CardTitle className="text-2xl text-red-600">{absentCount}</CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground">
            No clock-in recorded
          </CardContent>
        </Card>
      )}
    </div>
  );
}
