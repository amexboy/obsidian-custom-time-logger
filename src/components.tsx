import {useCallback, useMemo, useState} from "react";
import {differenceInMinutes, format, getMonth, getWeek} from "date-fns";
import type {NewEntryData} from "./AddEntryForm";
import {AddEntryForm} from "./AddEntryForm";
import {formatMinutes, parseDate, parseDurationToMinutes, parseTime} from "./helpers"; // Import the type

interface TimeEntryData {
	from: string;
	to: string;
	break?: string;
	note?: string;
}

interface DayLogData {
	[date: string]: TimeEntryData[];
}

interface PeriodData {
	from: string;
	to: string;
}

interface MonthIndex {
	[monthName: string]: DayLogData;
}

interface TimeLogRootBase {
	project: string;
	period: PeriodData;
}

export type TimeLogRootData = TimeLogRootBase & MonthIndex;

interface TimeLogViewProps {
	data: TimeLogRootData;
	// Add a prop to handle the update logic (passed from main.ts)
	// This is crucial for actually saving the data
	updateSourceData?: (newData: TimeLogRootData) => Promise<void>;
}

interface TimeLogViewContext {
	allExpanded: boolean;
	currentMonth: string;
	currentWeekNumber: number;
}

interface MonthSectionProps {
	monthName: string;
	monthData: DayLogData;
	context: TimeLogViewContext
}

interface WeekSectionProps {
	weekNumber: number;
	days: { dateStr: string; entries: TimeEntryData[] }[];
	context: TimeLogViewContext
}

interface DayEntryProps {
	dateStr: string;
	dayEntries: TimeEntryData[];
}

interface SingleEntryDisplayProps {
	entry: TimeEntryData;
	baseDate: Date;
}

// --- Components (SingleEntryDisplay, DayEntry, WeekSection, MonthSection remain the same) ---

// Renders a single time entry line within a day
const SingleEntryDisplay: React.FC<SingleEntryDisplayProps> = ({entry, baseDate}: SingleEntryDisplayProps) => {
	const startTime = parseTime(baseDate, entry.from);
	const endTime = parseTime(baseDate, entry.to);
	const breakMinutes = parseDurationToMinutes(entry.break);

	let durationMinutes = 0;
	let durationStr = "Invalid";

	if (startTime && endTime && endTime > startTime) {
		durationMinutes = differenceInMinutes(endTime, startTime) - breakMinutes;
		durationStr = formatMinutes(durationMinutes);
	} else if (startTime && endTime) {
		durationStr = "Negative/Zero";
	}

	const breakText =
		entry.break && breakMinutes > 0
			? `${formatMinutes(breakMinutes)} break`
			: "no break";

	return (
		<div className="time-log-single-entry">
      <span className="time-log-entry-time">
        {entry.from} – {entry.to}
      </span>
			<span className="time-log-entry-break">{breakText}</span>
			<span className="time-log-entry-duration">{durationStr}</span>
			{entry.note && (
				<span className="time-log-entry-note"> ({entry.note})</span>
			)}
		</div>
	);
};

// Renders all entries for a single day + the daily total
const DayEntry: React.FC<DayEntryProps> = ({dateStr, dayEntries,}: {
	dateStr: string,
	dayEntries: TimeEntryData[]
}) => {
	const baseDate = parseDate(dateStr); // Expects DD-MM-YYYY
	if (!baseDate) return null;

	const weekday = format(baseDate, "EEEE");

	let totalDayMinutes = 0;
	dayEntries.forEach((entry: TimeEntryData) => {
		const startTime = parseTime(baseDate, entry.from);
		const endTime = parseTime(baseDate, entry.to);
		const breakMinutes = parseDurationToMinutes(entry.break);
		if (startTime && endTime && endTime > startTime) {
			totalDayMinutes += differenceInMinutes(endTime, startTime) - breakMinutes;
		}
	});

	return (
		<div className="time-log-day-entry">
			<div className="time-log-day-header">
				<span className="time-log-day-weekday">{weekday}</span>
				<span className="time-log-day-total">
          {formatMinutes(totalDayMinutes)}
        </span>
			</div>
			<div className="time-log-day-entries-list">
				{dayEntries.map((entry, index) => (
					<SingleEntryDisplay
						key={index}
						entry={entry}
						baseDate={baseDate}
					/>
				))}
			</div>
		</div>
	);
};

const WeekSection: React.FC<WeekSectionProps> = ({weekNumber, days, context}: WeekSectionProps) => {
	// Expand if EITHER initiallyExpanded is true (due to parent/ExpandAll)
	// OR if this week is the current week.
	const shouldBeInitiallyExpanded = context.allExpanded || weekNumber === context.currentWeekNumber;
	const [isCollapsed, setIsCollapsed] = useState(!shouldBeInitiallyExpanded);

	const toggleCollapse = () => setIsCollapsed(!isCollapsed);

	const sortedDays = useMemo(
		() =>
			days.sort((a, b) => {
				const dateA = parseDate(a.dateStr); // Expects DD-MM-YYYY
				const dateB = parseDate(b.dateStr); // Expects DD-MM-YYYY
				return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
			}),
		[days],
	);

	return (
		<div className="time-log-week">
			<div onClick={toggleCollapse} className="time-log-section-header">
        <span
			className={`time-log-collapse-indicator ${
				isCollapsed ? "collapsed" : "expanded"
			}`}
		>
          {isCollapsed ? "▶" : "▼"}
        </span>
				Week {weekNumber}
			</div>
			{!isCollapsed && (
				<div className="time-log-week-content">
					{sortedDays.map(({dateStr, entries}) => (
						<DayEntry
							key={dateStr}
							dateStr={dateStr}
							dayEntries={entries}
						/>
					))}
				</div>
			)}
		</div>
	);
};

const MonthSection: React.FC<MonthSectionProps> = ({monthName, monthData, context}: MonthSectionProps) => {
	const [isExpanded, setIsCollapsed] = useState(context.allExpanded || context.currentMonth === monthName);
	const toggleCollapse = () => setIsCollapsed(!isExpanded);
	// --- Calculate Total Month Minutes using useMemo ---
	const totalMonthMinutes = useMemo(() => {
		let totalMinutes = 0;
		Object.keys(monthData).forEach((dateStr) => {
			const baseDate = parseDate(dateStr); // Expects DD-MM-YYYY
			if (!baseDate) return; // Skip if date is invalid

			const dayEntries = monthData[dateStr];
			dayEntries.forEach((entry: TimeEntryData) => {
				const startTime = parseTime(baseDate, entry.from);
				const endTime = parseTime(baseDate, entry.to);
				const breakMinutes = parseDurationToMinutes(entry.break);

				if (startTime && endTime && endTime > startTime) {
					totalMinutes +=
						differenceInMinutes(endTime, startTime) - breakMinutes;
				}
			});
		});
		return totalMinutes;
	}, [monthData]); // Recalculate only if monthData changes
	const formattedTotal = formatMinutes(totalMonthMinutes);
	const weeks = useMemo(() => {
		const grouped: {
			[weekNum: number]: { dateStr: string; entries: TimeEntryData[] }[];
		} = {};
		const sortedDays = Object.keys(monthData).sort((a, b) => {
			const dateA = parseDate(a); // Expects DD-MM-YYYY
			const dateB = parseDate(b); // Expects DD-MM-YYYY
			return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
		});

		sortedDays.forEach((dateStr) => {
			const entries = monthData[dateStr];
			const baseDate = parseDate(dateStr); // Expects DD-MM-YYYY
			if (baseDate && entries && entries.length > 0) {
				const weekOfYear = getWeek(baseDate, {weekStartsOn: 1});
				if (!grouped[weekOfYear]) {
					grouped[weekOfYear] = [];
				}
				grouped[weekOfYear].push({dateStr, entries});
			}
		});
		return Object.entries(grouped)
			.map(([weekNum, days]) => ({
				weekNumber: parseInt(weekNum, 10),
				days,
			}))
			.sort((a, b) => a.weekNumber - b.weekNumber);
	}, [monthData]);

	if (weeks.length === 0) return null;

	return (
		<div className="time-log-month">
			<div onClick={toggleCollapse} className="time-log-section-header">
				<span className="time-log-month-name">{monthName}</span>

				<span className="time-log-month-total">{formattedTotal}</span>

				<span
					className={`time-log-collapse-indicator-month ${
						isExpanded ? "expanded" : "collapsed"
					}`}
				>
            {isExpanded ? "▼" : "▶"}
        </span>
			</div>
			{isExpanded && (
				<div className="time-log-month-content">
					{weeks.map(({weekNumber, days}) => (
						<WeekSection
							key={`${weekNumber}`}
							weekNumber={weekNumber}
							days={days}
							context={context}
						/>
					))}
				</div>
			)}
		</div>
	);
};

// --- Main View Component ---
export const TimeLogView: React.FC<TimeLogViewProps> = ({data: initialData, updateSourceData,}: TimeLogViewProps) => {
	// Use state to manage the data for potential updates
	const [data, setData] = useState<TimeLogRootData>(initialData);
	const [allExpanded, setAllExpanded] = useState(false); // Initially all collapsed


	// Also get current month name if needed for expanding current month too
	// const currentMonthName = useMemo(() => format(new Date(), 'MMMM'), []);

	const periodStartDate = parseDate(data.period.from);
	const year = periodStartDate ? format(periodStartDate, "yyyy") : "Year";

	const months = Object.keys(data).filter(
		(key) => key !== "project" && key !== "period",
	);
	const monthOrder = [
		"January", "February", "March", "April", "May", "June",
		"July", "August", "September", "October", "November", "December",
	];


	const currentWeekNumber = useMemo(
		() => getWeek(new Date(), {weekStartsOn: 1}),
		[],
	);
	const currentMonth = useMemo(() => monthOrder[getMonth(new Date(), {})], []);

	const context: TimeLogViewContext = {allExpanded, currentWeekNumber, currentMonth};

	months.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a)); //decs
	// --- Toggle Function ---
	const toggleExpandAll = () => {
		setAllExpanded((prev) => !prev);
	};


	// --- Callback to handle adding a new entry ---
	const handleAddEntry = useCallback(
		async (newEntry: NewEntryData) => {
			console.log("Adding new entry:", newEntry);

			// --- Update the local state for immediate feedback ---
			const entryDate = parseDate(newEntry.date); // Expects DD-MM-YYYY
			if (!entryDate) {
				console.error("Invalid date received from form:", newEntry.date);
				return; // Or show an error to the user
			}
			const monthName = format(entryDate, "MMMM"); // e.g., April

			// Create a deep copy to avoid mutating the original state directly
			const newData = JSON.parse(JSON.stringify(data));

			// Ensure month exists
			if (!newData[monthName]) {
				newData[monthName] = {};
			}
			// Ensure date exists within the month
			if (!newData[monthName][newEntry.date]) {
				newData[monthName][newEntry.date] = [];
			}

			// Add the new entry
			newData[monthName][newEntry.date].push({
				from: newEntry.from,
				to: newEntry.to,
				break: newEntry.breakStr, // Store the original string
				// note: undefined // Add note field if needed later
			});

			// Sort entries within the day by start time (optional but good)
			newData[monthName][newEntry.date].sort((a: TimeEntryData, b: TimeEntryData) => {
				const timeA = parseTime(entryDate, a.from)?.getTime() || 0;
				const timeB = parseTime(entryDate, b.from)?.getTime() || 0;
				return timeA - timeB;
			});


			// Update the state to re-render the view
			setData(newData);

			// --- Persist the changes (if update function is provided) ---
			if (updateSourceData) {
				try {
					// Here you would convert `newData` back to YAML
					// and use the Obsidian API to write it back to the file.
					// This part is complex and needs careful implementation in main.ts
					console.log("Attempting to update source data (logic needed in main.ts)");
					// await updateSourceData(newData); // Pass the updated data structure
				} catch (error) {
					console.error("Failed to update source data:", error);
					// Optionally revert state or show an error
				}
			} else {
				console.warn(
					"updateSourceData function not provided. Changes are not saved.",
				);
			}
		},
		[data, updateSourceData], // Include dependencies
	);

	return (
		<div className="time-log-view">
			{/* --- Header Info --- */}
			<div className="time-log-info">
				<h3>{`${year}-${data.project}`}</h3>
				<div className="time-log-meta">
					<span>period</span> {data.period.from} – {data.period.to}
				</div>
				<div className="time-log-meta">
					<span>project</span> {data.project}
				</div>
			</div>

			{/* --- Add Entry Form --- */}
			{/* Pass the callback function to the form */}
			<AddEntryForm onAddEntry={handleAddEntry}/>

			{/* --- Controls Section --- */}
			<div className="time-log-controls">
				{/* Button moved to the right using CSS (e.g., flexbox justify-content: flex-end) */}
				{/* Or simple inline style for demonstration */}
				<button
					onClick={toggleExpandAll}
					className="time-log-expand-button icon-button" // Add class for styling
					aria-label={allExpanded ? "Collapse All" : "Expand All"}
					style={{marginLeft: "auto"}} // Simple way to push right
				>
					{/* Use icons (SVG, font icon, or simple characters) */}
					{allExpanded ? "⊟" : "⊞"}
					{/* Example using Obsidian icons (if available/setup): */}
					{/* {allExpanded ? <span className="obsidian-icon" data-icon="double-chevron-up"></span> : <span className="obsidian-icon" data-icon="double-chevron-down"></span>} */}
				</button>
			</div>


			{/* --- Log Entries --- */}
			<div className="time-log-entries">
				{months.map((monthName) => (
					<MonthSection
						key={`${monthName}-${allExpanded}`}
						monthName={monthName}
						monthData={data[monthName] as DayLogData}
						context={context}
					/>
				))}
			</div>
		</div>
	);
};
