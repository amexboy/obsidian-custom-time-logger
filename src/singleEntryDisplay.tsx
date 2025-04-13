import {SingleEntryDisplayProps} from "./types";
import {formatMinutes, parseDurationToMinutes, parseTime} from "./helpers";
import {differenceInMinutes} from "date-fns";

export const SingleEntryDisplay: React.FC<SingleEntryDisplayProps> = ({entry, baseDate,}) => {
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
