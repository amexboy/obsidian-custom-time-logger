// --- Data Types ---

export interface TimeEntryData {
	from: string; // HH:mm
	to: string; // HH:mm
	break?: string; // e.g., "30m", "1h"
	note?: string;
}

export interface DayLogData {
	[date: string]: TimeEntryData[]; // Key is DD-MM-YYYY
}

export interface PeriodData {
	from: string; // DD-MM-YYYY
	to: string; // DD-MM-YYYY
}

export interface MonthIndex {
	[monthName: string]: DayLogData; // Key is "January", "February", etc.
}

export interface TimeLogRootBase {
	project: string;
	period: PeriodData;
}

export type TimeLogRootData = TimeLogRootBase & MonthIndex;

// Type for the data passed from the AddEntryForm
export interface NewEntryData {
	date: string; // DD-MM-YYYY
	from: string; // HH:mm
	to: string; // HH:mm
	breakStr?: string; // e.g., "30m", "1h"
}

export interface TimeLogViewProps {
	data: TimeLogRootData;
	// Prop to handle updating the source markdown file
	updateSourceData?: (newData: TimeLogRootData) => Promise<void>;
}

export interface TimeLogViewContext {
	allExpanded: boolean;
	currentMonth: string;
	currentWeekNumber: number;
}

export interface MonthSectionProps {
	monthName: string;
	monthData: DayLogData;
	projectName: string;
	context: TimeLogViewContext;
}

export interface WeekSectionProps {
	weekNumber: number;
	days: { dateStr: string; entries: TimeEntryData[] }[];
	context: TimeLogViewContext;
}

export interface DayEntryProps {
	dateStr: string;
	dayEntries: TimeEntryData[];
}

export interface SingleEntryDisplayProps {
	entry: TimeEntryData;
	baseDate: Date;
}
