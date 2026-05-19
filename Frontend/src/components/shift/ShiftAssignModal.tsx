import { useState } from "react";
import { X, Clock, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { format } from "date-fns";

interface Worker {
  id: string;
  name: string;
}

interface ShiftTemplate {
  id: number;
  name: string;
  startTime: string;
  endTime: string;
  shiftType?: string;
}

interface ShiftAssignModalProps {
  open: boolean;
  onClose: () => void;
  workers: Worker[];
  shifts: ShiftTemplate[];
  selectedWorker?: string;
  selectedDate?: Date;
  onAssign: (data: {
    workerId: string;
    date: Date;
    shiftId: number;
    notes?: string;
  }) => void;
}

export function ShiftAssignModal({
  open,
  onClose,
  workers,
  shifts,
  selectedWorker,
  selectedDate,
  onAssign,
}: ShiftAssignModalProps) {
  const [workerId, setWorkerId] = useState(selectedWorker || "");
  const [date, setDate] = useState(
    selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [shiftId, setShiftId] = useState("");
  const [notes, setNotes] = useState("");

  if (!open) return null;

  const selectedShift = shifts.find((s) => s.id === Number(shiftId));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!workerId || !shiftId) return;
    
    onAssign({
      workerId,
      date: new Date(date),
      shiftId: Number(shiftId),
      notes,
    });
    
    // Reset and close
    setWorkerId("");
    setShiftId("");
    setNotes("");
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
          <h3 className="text-lg font-semibold text-slate-900">Assign Shift</h3>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-slate-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Worker Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              Worker
            </Label>
            <select
              value={workerId}
              onChange={(e) => setWorkerId(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
              required
            >
              <option value="">Select worker</option>
              {workers.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name || w.id}
                </option>
              ))}
            </select>
          </div>

          {/* Date Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              Date
            </Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          {/* Shift Selection */}
          <div className="space-y-2">
            <Label className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" />
              Shift Type
            </Label>
            <div className="grid grid-cols-2 gap-2">
              {shifts.map((shift) => (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => setShiftId(String(shift.id))}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    shiftId === String(shift.id)
                      ? "border-primary bg-primary/5"
                      : "border-slate-200 hover:border-slate-300"
                  }`}
                >
                  <p className="font-medium text-sm text-slate-900">{shift.name}</p>
                  <p className="text-xs text-slate-500">
                    {shift.startTime} - {shift.endTime}
                  </p>
                  {shift.shiftType && (
                    <span
                      className={`inline-block mt-1 px-1.5 py-0.5 rounded text-[10px] ${
                        shift.shiftType === "Morning"
                          ? "bg-blue-100 text-blue-700"
                          : shift.shiftType === "Evening"
                          ? "bg-amber-100 text-amber-700"
                          : shift.shiftType === "Night"
                          ? "bg-purple-100 text-purple-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {shift.shiftType}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Notes (optional)</Label>
            <Input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this shift..."
            />
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4">
            <Button type="button" variant="outline" className="flex-1" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              className="flex-1"
              disabled={!workerId || !shiftId}
            >
              Assign Shift
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
