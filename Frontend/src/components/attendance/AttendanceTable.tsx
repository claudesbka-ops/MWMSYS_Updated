import { Clock, MapPin } from "lucide-react";

interface AttendanceRow {
  id: number;
  workerId: string;
  checkIn?: string | Date;
  checkOut?: string | Date;
  checkInFmt?: string;
  checkOutFmt?: string;
  workedHours?: number;
  hoursWorked?: number;
  lateMinutes?: number;
  earlyLeaveMinutes?: number;
  lat?: string | number;
  lng?: string | number;
  status?: string;
}

interface AttendanceTableProps {
  rows: AttendanceRow[];
}

export function AttendanceTable({ rows }: AttendanceTableProps) {
  const getStatusColor = (status?: string) => {
    switch (status) {
      case "present":
        return "bg-green-100 text-green-800";
      case "late":
        return "bg-amber-100 text-amber-800";
      case "absent":
        return "bg-red-100 text-red-800";
      case "half_day":
        return "bg-orange-100 text-orange-800";
      default:
        return "bg-slate-100 text-slate-800";
    }
  };

  const formatTime = (dateStr?: string | Date) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "—" : d.toLocaleTimeString();
  };

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return "—";
    const d = new Date(dateStr);
    return isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
  };

  return (
    <table className="w-full text-sm">
      <thead className="bg-slate-50 border-b border-slate-200">
        <tr>
          <th className="px-4 py-3 text-left font-medium text-slate-700">Worker</th>
          <th className="px-4 py-3 text-left font-medium text-slate-700">Date</th>
          <th className="px-4 py-3 text-left font-medium text-slate-700">Clock In</th>
          <th className="px-4 py-3 text-left font-medium text-slate-700">Clock Out</th>
          <th className="px-4 py-3 text-left font-medium text-slate-700">Hours</th>
          <th className="px-4 py-3 text-left font-medium text-slate-700">Status</th>
          <th className="px-4 py-3 text-left font-medium text-slate-700">Location</th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {rows.map((row) => (
          <tr key={row.id} className="hover:bg-slate-50">
            <td className="px-4 py-3 font-medium text-slate-900">
              {row.workerId}
            </td>
            <td className="px-4 py-3 text-slate-600">
              {formatDate(row.checkIn)}
            </td>
            <td className="px-4 py-3 text-slate-600">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatTime(row.checkIn)}
              </div>
              {row.lateMinutes ? (
                <span className="text-xs text-amber-600">
                  +{row.lateMinutes}m late
                </span>
              ) : null}
            </td>
            <td className="px-4 py-3 text-slate-600">
              <div className="flex items-center gap-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                {formatTime(row.checkOut)}
              </div>
              {row.earlyLeaveMinutes ? (
                <span className="text-xs text-orange-600">
                  -{row.earlyLeaveMinutes}m early
                </span>
              ) : null}
            </td>
            <td className="px-4 py-3 text-slate-600">
              {row.hoursWorked || row.workedHours
                ? `${(row.hoursWorked || row.workedHours).toFixed(1)}h`
                : "—"}
            </td>
            <td className="px-4 py-3">
              <span
                className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(
                  row.status
                )}`}
              >
                {row.status || "present"}
              </span>
            </td>
            <td className="px-4 py-3 text-slate-600">
              {row.lat && row.lng ? (
                <div className="flex items-center gap-1 text-xs">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-slate-500">
                    {Number(row.lat).toFixed(4)}, {Number(row.lng).toFixed(4)}
                  </span>
                </div>
              ) : (
                <span className="text-slate-400">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
