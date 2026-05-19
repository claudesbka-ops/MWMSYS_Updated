import { format, addDays, startOfWeek } from "date-fns";
import { User } from "lucide-react";

interface ShiftData {
  workerId: string;
  workerName?: string;
  date: string;
  shiftType?: string;
  startTime?: string;
  endTime?: string;
}

interface ShiftCalendarProps {
  range: { from: Date; to: Date };
  rosterData?: ShiftData[];
  workers?: Array<{ id: string; name: string }>;
  onCellClick?: (workerId: string, date: Date) => void;
}

const shiftColors: Record<string, string> = {
  Morning: "bg-blue-100 text-blue-800 border-blue-200",
  Evening: "bg-amber-100 text-amber-800 border-amber-200",
  Night: "bg-purple-100 text-purple-800 border-purple-200",
  Off: "bg-slate-100 text-slate-500 border-slate-200",
  default: "bg-slate-50 text-slate-600 border-slate-200",
};

export function ShiftCalendar({
  range,
  rosterData = [],
  workers = [],
  onCellClick,
}: ShiftCalendarProps) {
  // Generate 7 days from range
  const days: Date[] = [];
  let current = new Date(range.from);
  const end = new Date(range.to);
  
  while (current <= end) {
    days.push(new Date(current));
    current.setDate(current.getDate() + 1);
  }

  // Get unique workers from roster data if no workers prop provided
  const workerList = workers.length > 0 
    ? workers 
    : Array.from(new Set(rosterData.map(r => r.workerId))).map(id => ({ id, name: id }));

  // Create lookup map for shifts
  const shiftMap = new Map<string, ShiftData>();
  rosterData.forEach(shift => {
    const key = `${shift.workerId}__${shift.date.slice(0, 10)}`;
    shiftMap.set(key, shift);
  });

  const getShiftForCell = (workerId: string, date: Date) => {
    const dateStr = date.toISOString().slice(0, 10);
    const key = `${workerId}__${dateStr}`;
    return shiftMap.get(key);
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header - Days */}
      <div className="grid grid-cols-[200px_repeat(7,1fr)] border-b border-slate-200 bg-slate-50">
        <div className="px-4 py-3 font-medium text-slate-700 border-r border-slate-200">
          Worker
        </div>
        {days.map((day, idx) => (
          <div
            key={idx}
            className="px-2 py-3 text-center text-sm font-medium text-slate-600 border-r border-slate-200 last:border-r-0"
          >
            <div>{format(day, "EEE")}</div>
            <div className="text-xs text-slate-400">{format(day, "d MMM")}</div>
          </div>
        ))}
      </div>

      {/* Worker Rows */}
      <div className="divide-y divide-slate-100">
        {workerList.map((worker) => (
          <div
            key={worker.id}
            className="grid grid-cols-[200px_repeat(7,1fr)] hover:bg-slate-50"
          >
            {/* Worker Name Cell */}
            <div className="px-4 py-3 border-r border-slate-200 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center">
                <User className="w-4 h-4 text-slate-500" />
              </div>
              <div className="truncate">
                <p className="font-medium text-slate-900 text-sm">{worker.name || worker.id}</p>
                <p className="text-xs text-slate-500">{worker.id}</p>
              </div>
            </div>

            {/* Day Cells */}
            {days.map((day, dayIdx) => {
              const shift = getShiftForCell(worker.id, day);
              const colorClass = shiftColors[shift?.shiftType || "Off"] || shiftColors.default;
              
              return (
                <div
                  key={dayIdx}
                  className={`p-2 border-r border-slate-200 last:border-r-0 ${
                    onCellClick ? "cursor-pointer hover:bg-slate-100" : ""
                  }`}
                  onClick={() => onCellClick?.(worker.id, day)}
                >
                  {shift ? (
                    <div className={`rounded-lg p-2 text-xs border ${colorClass}`}>
                      <p className="font-medium">{shift.shiftType || "Shift"}</p>
                      {shift.startTime && shift.endTime && (
                        <p className="text-xs opacity-80">
                          {shift.startTime}-{shift.endTime}
                        </p>
                      )}
                    </div>
                  ) : (
                    <div className="h-full min-h-[60px] rounded-lg border border-dashed border-slate-200 flex items-center justify-center">
                      <span className="text-xs text-slate-300">No shift</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}

        {workerList.length === 0 && (
          <div className="px-4 py-8 text-center text-slate-500">
            No workers assigned for this period
          </div>
        )}
      </div>
    </div>
  );
}
