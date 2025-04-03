import {useMemo, useState} from 'react';
import {differenceInMinutes, format, getWeek,} from 'date-fns';

// --- Interfaces (can be shared or redefined here) ---
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

// --- Helper Function Props ---
interface HelperFunctions {
	parseDurationToMinutes: (durationStr?: string) => number;
	parseTime: (baseDate: Date, timeStr: string) => Date | null;
	parseDate: (dateStr: string) => Date | null;
	formatMinutes: (totalMinutes: number) => string;
}

// --- Component Props ---
interface TimeLogViewProps {
	data: TimeLogRootData;
	helpers: HelperFunctions;
}

interface MonthSectionProps {
	monthName: string;
	monthData: DayLogData;
	helpers: HelperFunctions;
}

interface WeekSectionProps {
	weekNumber: number;
	days: { dateStr: string; entries: TimeEntryData[] }[];
	helpers: HelperFunctions;
}

interface DayTableProps {
	dateStr: string;
	dayEntries: TimeEntryData[];
	helpers: HelperFunctions;
}

// --- Components ---

const EntryRow: React.FC<{
	entry: TimeEntryData;
	baseDate: Date;
	helpers: HelperFunctions;
}> = ({entry, baseDate, helpers}) => {
	const startTime = helpers.parseTime(baseDate, entry.from);
	const endTime = helpers.parseTime(baseDate, entry.to);
	const breakMinutes = helpers.parseDurationToMinutes(entry.break);

	let durationMinutes = 0;
	let durationStr = 'Invalid';

	if (startTime && endTime && endTime > startTime) {
		durationMinutes = differenceInMinutes(endTime, startTime) - breakMinutes;
		durationStr = helpers.formatMinutes(durationMinutes);
	} else if (startTime && endTime) {
		durationStr = 'Negative/Zero';
	}

	const breakText = entry.break ? entry.break : '0m';

	return (
		<tr className="time-log-entry-row">
			<td>{entry.from}</td>
			<td>{entry.to}</td>
			<td>{breakText}</td>
			<td>{durationStr}</td>
			<td className="time-log-entry-details">
				{entry.note && (
					<span className="time-log-entry-note">{entry.note}</span>
				)}
				<span className="time-log-entry-actions">⋮</span>
			</td>
		</tr>
	);
};

const TotalRow: React.FC<{ totalMinutes: number; helpers: HelperFunctions }> = ({
																					totalMinutes,
																					helpers,
																				}) => {
	return (
		<tr className="time-log-total-row">
			<td colSpan={3}>
				<strong>Total</strong>
			</td>
			<td>
				<strong>{helpers.formatMinutes(totalMinutes)}</strong>
			</td>
			<td></td>
			{/* Empty cell for alignment */}
		</tr>
	);
};

const DayTable: React.FC<DayTableProps> = ({dateStr, dayEntries, helpers,}) => {
	const baseDate = helpers.parseDate(dateStr);
	if (!baseDate) return null; // Skip rendering if date is invalid

	const weekday = format(baseDate, 'EEEE'); // e.g., Tuesday
	const displayDate = format(baseDate, 'dd MMM'); // e.g., 01 Apr

	let totalDayMinutes = 0;
	dayEntries.forEach((entry) => {
		const startTime = helpers.parseTime(baseDate, entry.from);
		const endTime = helpers.parseTime(baseDate, entry.to);
		const breakMinutes = helpers.parseDurationToMinutes(entry.break);
		if (startTime && endTime && endTime > startTime) {
			totalDayMinutes += differenceInMinutes(endTime, startTime) - breakMinutes;
		}
	});

	return (
		<div className="time-log-day-section">
			<div className="time-log-day-header">
				{weekday}, {displayDate}
			</div>
			<table className="time-log-day-table">
				<thead>
				<tr>
					<th>From</th>
					<th>To</th>
					<th>Break</th>
					<th>Duration</th>
					<th></th>
					{/* Actions/Notes */}
				</tr>
				</thead>
				<tbody>
				{dayEntries.map((entry, index) => (
					<EntryRow
						key={index}
						entry={entry}
						baseDate={baseDate}
						helpers={helpers}
					/>
				))}
				{/* Conditionally render total row */}
				{dayEntries.length > 1 && (
					<TotalRow totalMinutes={totalDayMinutes} helpers={helpers}/>
				)}
				</tbody>
			</table>
		</div>
	);
};

const WeekSection: React.FC<WeekSectionProps> = ({weekNumber, days, helpers,}) => {
	const [isCollapsed, setIsCollapsed] = useState(false); // Default to expanded

	const toggleCollapse = () => setIsCollapsed(!isCollapsed);

	return (
		<div className="time-log-week">
			<h5 onClick={toggleCollapse} className="time-log-section-header">
				Week {weekNumber} {isCollapsed ? '>' : 'V'}
			</h5>
			{!isCollapsed && (
				<div className="time-log-week-content">
					{days.map(({dateStr, entries}) => (
						<DayTable
							key={dateStr}
							dateStr={dateStr}
							dayEntries={entries}
							helpers={helpers}
						/>
					))}
				</div>
			)}
		</div>
	);
};

const MonthSection: React.FC<MonthSectionProps> = ({monthName, monthData, helpers,}) => {
	const [isCollapsed, setIsCollapsed] = useState(true); // Default to collapsed

	const toggleCollapse = () => setIsCollapsed(!isCollapsed);

	// Group days by week
	const weeks = useMemo(() => {
		const grouped: {
			[weekNum: number]: { dateStr: string; entries: TimeEntryData[] }[];
		} = {};
		const sortedDays = Object.keys(monthData).sort((a, b) => {
			const dateA = helpers.parseDate(a);
			const dateB = helpers.parseDate(b);
			return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
		});

		sortedDays.forEach((dateStr) => {
			const entries = monthData[dateStr];
			const baseDate = helpers.parseDate(dateStr);
			if (baseDate && entries && entries.length > 0) {
				const weekOfYear = getWeek(baseDate, {weekStartsOn: 1}); // ISO week
				if (!grouped[weekOfYear]) {
					grouped[weekOfYear] = [];
				}
				grouped[weekOfYear].push({dateStr, entries});
			}
		});
		return Object.entries(grouped).map(([weekNum, days]) => ({
			weekNumber: parseInt(weekNum, 10),
			days,
		}));
	}, [monthData, helpers]);

	if (weeks.length === 0) return null; // Don't render empty months

	return (
		<div className="time-log-month">
			<h4 onClick={toggleCollapse} className="time-log-section-header">
				{monthName} {isCollapsed ? '>' : 'V'}
			</h4>
			{!isCollapsed && (
				<div className="time-log-month-content">
					{weeks.map(({weekNumber, days}) => (
						<WeekSection
							key={weekNumber}
							weekNumber={weekNumber}
							days={days}
							helpers={helpers}
						/>
					))}
				</div>
			)}
		</div>
	);
};

export const TimeLogView: React.FC<TimeLogViewProps> = ({data, helpers}) => {
	const periodStartDate = helpers.parseDate(data.period.from);
	const year = periodStartDate ? format(periodStartDate, 'yyyy') : 'Year';

	const months = Object.keys(data).filter(
		(key) => key !== 'project' && key !== 'period',
	);
	const monthOrder = [
		'January', 'February', 'March', 'April', 'May', 'June',
		'July', 'August', 'September', 'October', 'November', 'December'
	];
	months.sort((a, b) => monthOrder.indexOf(a) - monthOrder.indexOf(b));


	return (
		<div className="time-log-view">
			{/* --- Header Info --- */}
			<div className="time-log-info">
				<h3>{`${year}-${data.project}`}</h3>
				<div>{`period ${data.period.from} - ${data.period.to}`}</div>
				<div>{`project ${data.project}`}</div>
			</div>

			{/* --- Add Entry Section (Static UI) --- */}
			<div className="time-log-add-entry">
				<input type="text" placeholder="DD-MM-YYYY"/>
				<input type="text" placeholder="From (HH:mm)"/>
				<input type="text" placeholder="Break (e.g., 30m)"/>
				<input type="text" placeholder="To (HH:mm)"/>
				<button>+</button>
			</div>

			{/* --- Log Entries --- */}
			<div className="time-log-entries">
				{months.map((monthName) => (
					<MonthSection
						key={monthName}
						monthName={monthName}
						monthData={data[monthName]}
						helpers={helpers}
					/>
				))}
			</div>
		</div>
	);
};
