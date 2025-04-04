// src/AddEntryForm.tsx
import {useCallback, useState} from "react";
import {format} from "date-fns";

// Define the structure of the data passed up when adding
export interface NewEntryData {
	date: string; // YYYY-MM-DD format
	from: string; // HH:mm format
	to: string; // HH:mm format
	breakStr: string; // Original break string e.g., "30m", "1h"
}

interface AddEntryFormProps {
	// Callback function to execute when a valid entry is added
	onAddEntry: (newEntry: NewEntryData) => void;
	// Optional: Helper to validate break format if needed externally
	// validateBreakFormat?: (breakStr: string) => boolean;
}

// Basic validation for HH:mm format
const isValidTime = (timeStr: string): boolean => /^\d{2}:\d{2}$/.test(timeStr);

// Basic validation for break format (digits + h/m)
const isValidBreakFormat = (breakStr: string): boolean => {
	if (!breakStr) return true; // Empty break is allowed (means 0)
	return /^\d+(\.\d+)?\s*h$|^\d+\s*m$/.test(breakStr.trim());
};

export const AddEntryForm: React.FC<AddEntryFormProps> = ({onAddEntry}) => {
	// Default to today's date in YYYY-MM-DD format
	const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
	const [fromTime, setFromTime] = useState<string>(""); // HH:mm
	const [breakText, setBreakText] = useState<string>(""); // e.g., "30m"
	const [toTime, setToTime] = useState<string>(""); // HH:mm
	const [error, setError] = useState<string | null>(null);

	const handleAddClick = useCallback(() => {
		setError(null); // Clear previous errors

		// --- Input Validation ---
		if (!date) {
			setError("Please select a date.");
			return;
		}
		if (!fromTime || !isValidTime(fromTime)) {
			setError("Please enter a valid 'From' time (HH:mm).");
			return;
		}
		if (!toTime || !isValidTime(toTime)) {
			setError("Please enter a valid 'To' time (HH:mm).");
			return;
		}
		if (!isValidBreakFormat(breakText)) {
			setError(
				"Invalid break format. Use numbers followed by 'h' or 'm' (e.g., '1h', '30m').",
			);
			return;
		}
		// Optional: Add validation for From time being before To time

		// --- Prepare Data ---
		// Convert date from YYYY-MM-DD to DD-MM-YYYY for consistency with YAML
		const [year, month, day] = date.split("-");
		const formattedDate = `${day}-${month}-${year}`;

		const newEntryData: NewEntryData = {
			date: formattedDate,
			from: fromTime,
			to: toTime,
			breakStr: breakText.trim() || "0m", // Send "0m" if empty
		};

		// --- Execute Callback ---
		onAddEntry(newEntryData);

		// --- Reset Form (Optional) ---
		// setFromTime("");
		// setBreakText("");
		// setToTime("");
		// setDate(format(new Date(), "yyyy-MM-dd")); // Reset date or keep it?
	}, [date, fromTime, breakText, toTime, onAddEntry]);

	return (
		<div className="time-log-add-entry">
			<input
				type="date"
				value={date}
				onChange={(e) => setDate(e.target.value)}
				aria-label="Date"
				className="time-log-add-input"
			/>
			<input
				type="time"
				value={fromTime}
				onChange={(e) => setFromTime(e.target.value)}
				placeholder="From"
				aria-label="From time"
				className="time-log-add-input"
				step="1800"
			/>
			<input
				type="text"
				value={breakText}
				onChange={(e) => setBreakText(e.target.value)}
				placeholder="Break (e.g., 30m)"
				aria-label="Break duration"
				className={`time-log-add-input ${
					!isValidBreakFormat(breakText) && breakText ? "input-error" : ""
				}`} // Add error class styling
			/>
			<input
				type="time"
				value={toTime}
				onChange={(e) => setToTime(e.target.value)}
				placeholder="To"
				aria-label="To time"
				className="time-log-add-input"
				step="1800"
			/>
			<button
				onClick={handleAddClick}
				className="time-log-add-action"
				aria-label="Add time entry"
			>
				+
			</button>
			{error && <div className="time-log-add-error">{error}</div>}
		</div>
	);
};
