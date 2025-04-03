// main.ts (or a separate utils.ts)

import {format, parse as dateParse,} from 'date-fns';

/**
 * Parses a duration string (e.g., "1h", "30m", "1.5h", "1h 30m")
 * into total minutes.
 * Returns 0 if the string is empty, null, undefined, or invalid.
 */
export function parseDurationToMinutes(durationStr?: string | null): number {
	if (!durationStr) {
		return 0;
	}

	let totalMinutes = 0;
	const durationNormalized = durationStr.trim().toLowerCase();

	// Match patterns like "1.5h", "1 h", "30m", "30 m", or combinations
	const hourMatches = durationNormalized.match(/(\d+(\.\d+)?)\s*h/g) || [];
	const minMatches = durationNormalized.match(/(\d+)\s*m/g) || [];

	hourMatches.forEach((match) => {
		const hours = parseFloat(match.replace(/[^\d.]/g, '')); // Extract number
		if (!isNaN(hours)) {
			totalMinutes += hours * 60;
		}
	});

	minMatches.forEach((match) => {
		const minutes = parseInt(match.replace(/[^\d]/g, ''), 10); // Extract number
		if (!isNaN(minutes)) {
			totalMinutes += minutes;
		}
	});

	// Return rounded integer minutes
	return Math.round(totalMinutes);
}

/**
 * Parses a time string (HH:mm) and sets it on a given base date.
 * Returns null if the time string is invalid.
 */
export function parseTime(baseDate: Date, timeStr: string): Date | null {
	if (!timeStr || typeof timeStr !== 'string') {
		return null;
	}
	const timeParts = timeStr.match(/^(\d{1,2}):(\d{2})$/); // HH:mm format

	if (!timeParts) {
		console.warn('Invalid time format:', timeStr, '- Expected HH:mm');
		return null;
	}

	try {
		const hour = parseInt(timeParts[1], 10);
		const minute = parseInt(timeParts[2], 10);

		// Basic validation for hours and minutes
		if (
			isNaN(hour) ||
			hour < 0 ||
			hour > 23 ||
			isNaN(minute) ||
			minute < 0 ||
			minute > 59
		) {
			console.warn('Invalid time value:', timeStr);
			return null;
		}

		// Create a new Date object to avoid modifying the original baseDate
		const newDate = new Date(baseDate);
		newDate.setHours(hour, minute, 0, 0); // Set hours, minutes, reset seconds/ms
		return newDate;
	} catch (e) {
		console.error('Error parsing time:', timeStr, e);
		return null;
	}
}

/**
 * Parses a date string in DD-MM-YYYY format into a Date object.
 * Returns null if the format is invalid or the date doesn't exist.
 */
export function parseDate(dateStr: string): Date | null {
	if (!dateStr || typeof dateStr !== 'string') {
		return null;
	}
	try {
		// Use date-fns parse for robust parsing
		// It requires a reference date, but it's mainly for default values
		// if the input string is incomplete, which shouldn't happen here.
		const parsedDate = dateParse(dateStr, 'dd-MM-yyyy', new Date());

		// date-fns parse can be lenient. Add a check to ensure the formatted
		// date matches the input, catching invalid dates like 31-02-2025.
		if (format(parsedDate, 'dd-MM-yyyy') !== dateStr) {
			console.warn(
				'Invalid date value after parsing:',
				dateStr,
				'-> resulted in',
				format(parsedDate, 'dd-MM-yyyy'),
			);
			return null; // Date doesn't actually exist (e.g., Feb 31st)
		}

		return parsedDate;
	} catch (e) {
		// This catch might not be strictly necessary with date-fns unless
		// there's a very unexpected error, but it's good practice.
		console.error('Error parsing date:', dateStr, e);
		return null;
	}
}

/**
 * Formats a total number of minutes into a string like "1h 30m", "2h", "45m".
 * Returns "0m" for 0 or negative minutes.
 */
export function formatMinutes(totalMinutes: number): string {
	if (isNaN(totalMinutes) || totalMinutes <= 0) {
		return '0m';
	}

	const hours = Math.floor(totalMinutes / 60);
	const minutes = totalMinutes % 60;

	let durationStr = '';
	if (hours > 0) {
		durationStr += `${hours}h`;
	}
	if (minutes > 0) {
		// Add a space if hours were also present
		if (hours > 0) {
			durationStr += ' ';
		}
		durationStr += `${minutes}m`;
	}

	// Should only be empty if totalMinutes was 0, handled above.
	// But as a fallback, return '0m'.
	return durationStr || '0m';
}
