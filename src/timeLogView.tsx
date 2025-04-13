// --- Main View Component ---
import {useCallback, useMemo, useState} from "react";
import {
	monthOrder,
	parseDate,
	parseTime,
} from "./helpers";
import {format, getMonth, getWeek} from "date-fns";
import {AddEntryForm} from "./AddEntryForm";
import {DayLogData, NewEntryData, TimeEntryData, TimeLogRootData, TimeLogViewContext, TimeLogViewProps} from "./types";
import {MonthSection} from "./monthSection";

export const TimeLogView: React.FC<TimeLogViewProps> = ({ data: initialData, updateSourceData, }) => {
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
		() => getWeek(new Date(), {weekStartsOn: 1}),
		[],
	);
	const currentMonth = useMemo(() => monthOrder[getMonth(new Date())], []); // Use imported monthOrder

	const context: TimeLogViewContext = useMemo( // Memoize context object
		() => ({allExpanded, currentWeekNumber, currentMonth}),
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

			<AddEntryForm onAddEntry={handleAddEntry}/>

			<div className="time-log-controls">
				<button
					onClick={toggleExpandAll}
					className="time-log-expand-button icon-button"
					aria-label={allExpanded ? 'Collapse All' : 'Expand All'}
					style={{marginLeft: 'auto'}} // Simple alignment
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
						projectName={data.project}
						context={context}
					/>
				))}
			</div>
		</div>
	);
};
