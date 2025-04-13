import { useCallback, useMemo, useState } from 'react'; // Added React import
import { differenceInMinutes, format, getMonth, getWeek } from 'date-fns';

// Import types and helpers from the central file
import {
	formatMinutes,
	parseDate,
	parseDurationToMinutes,
	parseTime,
	calculateMonthTotalMinutes,
	groupDaysIntoWeeks,
	monthOrder, // Import constant
	type TimeEntryData, // Import types
	type DayLogData,
	type TimeLogRootData,
	type NewEntryData,
} from './helpers'; // Adjust path if needed

import { AddEntryForm } from './AddEntryForm';

// --- Component-Specific Prop Types (Remain Here) ---

interface TimeLogViewProps {
	data: TimeLogRootData;
	// Prop to handle updating the source markdown file
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
	context: TimeLogViewContext;
}

interface WeekSectionProps {
	weekNumber: number;
	days: { dateStr: string; entries: TimeEntryData[] }[];
	context: TimeLogViewContext;
}

interface DayEntryProps {
	dateStr: string;
	dayEntries: TimeEntryData[];
}

interface SingleEntryDisplayProps {
	entry: TimeEntryData;
	baseDate: Date;
}

// --- Sub-Components (Simplified Comments) ---

const SingleEntryDisplay: React.FC<SingleEntryDisplayProps> = ({ entry, baseDate, }) => {
	const startTime = parseTime(baseDate, entry.from);
	const endTime = parseTime(baseDate, entry.to);
	const breakMinutes = parseDurationToMinutes(entry.break);

	let durationMinutes = 0;
	let durationStr = 'Invalid';

	if (startTime && endTime && endTime > startTime) {
		durationMinutes = differenceInMinutes(endTime, startTime) - breakMinutes;
		durationStr = formatMinutes(durationMinutes);
	} else if (startTime && endTime) {
		durationStr = 'Negative/Zero';
	}

	const breakText =
		entry.break && breakMinutes > 0
			? `${formatMinutes(breakMinutes)} break`
			: 'no break';

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

const DayEntry: React.FC<DayEntryProps> = ({ dateStr, dayEntries }) => {
	const baseDate = parseDate(dateStr);
	if (!baseDate) return null;

	const weekday = format(baseDate, 'EEEE');

	let totalDayMinutes = 0;
	dayEntries.forEach((entry) => {
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
						key={index} // Consider a more stable key if entries can be deleted/reordered
						entry={entry}
						baseDate={baseDate}
					/>
				))}
			</div>
		</div>
	);
};

const WeekSection: React.FC<WeekSectionProps> = ({ weekNumber, days, context, }) => {
	// Expand if allExpanded is true OR if this week is the current week.
	const shouldBeInitiallyExpanded =
		context.allExpanded || weekNumber === context.currentWeekNumber;
	const [isCollapsed, setIsCollapsed] = useState(!shouldBeInitiallyExpanded);

	const toggleCollapse = () => setIsCollapsed(!isCollapsed);

	// Days are pre-sorted by the groupDaysIntoWeeks helper
	const sortedDays = days;

	return (
		<div className="time-log-week">
			<div onClick={toggleCollapse} className="time-log-section-header">
				<span
					className={`time-log-collapse-indicator ${
						isCollapsed ? 'collapsed' : 'expanded'
					}`}
				>
					{isCollapsed ? '▶' : '▼'}
				</span>
				Week {weekNumber}
			</div>
			{!isCollapsed && (
				<div className="time-log-week-content">
					{sortedDays.map(({ dateStr, entries }) => (
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

const MonthSection: React.FC<MonthSectionProps> = ({ monthName, monthData, context, }) => {
	const [isExpanded, setIsExpanded] = useState( // Corrected: useState(!isCollapsed) -> useState(isExpanded)
		context.allExpanded || context.currentMonth === monthName,
	);
	const toggleCollapse = () => setIsExpanded(!isExpanded); // Corrected: setIsCollapsed -> setIsExpanded

	// Use helper function for total calculation
	const totalMonthMinutes = useMemo(
		() => calculateMonthTotalMinutes(monthData),
		[monthData],
	);
	const formattedTotal = formatMinutes(totalMonthMinutes);

	// Use helper function for week grouping
	const weeks = useMemo(() => groupDaysIntoWeeks(monthData), [monthData]);

	if (weeks.length === 0) return null;

	return (
		<div className="time-log-month">
			<div onClick={toggleCollapse} className="time-log-section-header">
				<span className="time-log-month-name">{monthName}</span>
				<span className="time-log-month-total">{formattedTotal}</span>
				<span
					className={`time-log-collapse-indicator-month ${
						isExpanded ? 'expanded' : 'collapsed'
					}`}
				>
					{isExpanded ? '▼' : '▶'}
				</span>
			</div>
			{isExpanded && (
				<div className="time-log-month-content">
					{weeks.map(({ weekNumber, days }) => (
						<WeekSection
							// Add monthName to key to ensure uniqueness across months if week numbers repeat
							key={`${monthName}-${weekNumber}`}
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
export const TimeLogView: React.FC<TimeLogViewProps> = ({
															data: initialData,
															updateSourceData,
														}) => {
	const [data, setData] = useState<TimeLogRootData>(initialData);
	const [allExpanded, setAllExpanded] = useState(false);

	const periodStartDate = parseDate(data.period.from);
	const year = periodStartDate ? format(periodStartDate, 'yyyy') : 'Year';

	// Filter out non-month keys and sort using the imported constant/order
	const months = useMemo(() => {
		return Object.keys(data)
			.filter((key) => key !== 'project' && key !== 'period')
			.sort((a, b) => monthOrder.indexOf(b) - monthOrder.indexOf(a)); // Descending
	}, [data]);

	const currentWeekNumber = useMemo(
		() => getWeek(new Date(), { weekStartsOn: 1 }),
		[],
	);
	const currentMonth = useMemo(() => monthOrder[getMonth(new Date())], []); // Use imported monthOrder

	const context: TimeLogViewContext = useMemo( // Memoize context object
		() => ({ allExpanded, currentWeekNumber, currentMonth }),
		[allExpanded, currentWeekNumber, currentMonth],
	);

	const toggleExpandAll = () => {
		setAllExpanded((prev) => !prev);
	};

	const handleAddEntry = useCallback(
		async (newEntry: NewEntryData) => {
			console.log('Adding new entry:', newEntry);

			const entryDate = parseDate(newEntry.date);
			if (!entryDate) {
				console.error('Invalid date received from form:', newEntry.date);
				// Consider showing a user-facing error (e.g., using Obsidian's Notice)
				return;
			}
			const monthName = format(entryDate, 'MMMM');

			// Deep copy to avoid direct state mutation
			const newData = JSON.parse(JSON.stringify(data)) as TimeLogRootData;

			// Ensure month and date arrays exist
			if (!newData[monthName]) {
				newData[monthName] = {};
			}
			if (!newData[monthName][newEntry.date]) {
				newData[monthName][newEntry.date] = [];
			}

			// Add the new entry
			const entryToAdd: TimeEntryData = {
				from: newEntry.from,
				to: newEntry.to,
				break: newEntry.breakStr, // Store the original string
				// note: undefined // Add note field if needed later
			};
			newData[monthName][newEntry.date].push(entryToAdd);

			// Sort entries within the day by start time (descending for display)
			newData[monthName][newEntry.date].sort((a, b) => {
				const timeA = parseTime(entryDate, a.from)?.getTime() || 0;
				const timeB = parseTime(entryDate, b.from)?.getTime() || 0;
				return timeB - timeA; // Descending order
			});

			// Update local state for immediate UI feedback
			setData(newData);

			// Persist the changes via the passed callback
			if (updateSourceData) {
				try {
					await updateSourceData(newData);
				} catch (error) {
					console.error('Failed to update source data:', error);
					// TODO: Consider reverting state or showing a persistent error message
					// Example: setData(data); // Revert to previous state
					// Example: new Notice("Failed to save entry.");
				}
			} else {
				console.warn(
					'updateSourceData function not provided. Changes are not saved.',
				);
			}
		},
		[data, updateSourceData], // Dependencies for useCallback
	);

	return (
		<div className="time-log-view">
			<div className="time-log-info">
				<h3>{`${year}-${data.project}`}</h3>
				<div className="time-log-meta">
					<span>period</span> {data.period.from} – {data.period.to}
				</div>
				<div className="time-log-meta">
					<span>project</span> {data.project}
				</div>
			</div>

			<AddEntryForm onAddEntry={handleAddEntry} />

			<div className="time-log-controls">
				<button
					onClick={toggleExpandAll}
					className="time-log-expand-button icon-button"
					aria-label={allExpanded ? 'Collapse All' : 'Expand All'}
					style={{ marginLeft: 'auto' }} // Simple alignment
				>
					{/* Simple text icons */}
					{allExpanded ? '⊟' : '⊞'}
				</button>
			</div>

			<div className="time-log-entries">
				{months.map((monthName) => (
					<MonthSection
						// Add allExpanded to key to force re-render of children's initial state
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
