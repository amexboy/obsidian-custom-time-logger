import {DayEntryProps} from "./types";
import {formatMinutes, parseDate, parseDurationToMinutes, parseTime} from "./helpers";
import {differenceInMinutes, format} from "date-fns";
import {SingleEntryDisplay} from "./singleEntryDisplay";
import styled from "styled-components";

const Subtext = styled.span`
  color: gray;
  font-size: 0.875rem;
`;

export const DayEntry: React.FC<DayEntryProps> = ({dateStr, dayEntries}) => {
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
				<span className="time-log-day-weekday">{weekday} <Subtext>{dateStr}</Subtext></span>
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
