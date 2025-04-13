import {WeekSectionProps} from "./types";
import {useState} from "react";
import {DayEntry} from "./dayEntry";

export const WeekSection: React.FC<WeekSectionProps> = ({weekNumber, days, context,}) => {
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
