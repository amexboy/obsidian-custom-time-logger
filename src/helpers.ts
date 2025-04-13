
import {
	App,
	MarkdownPostProcessorContext,
	Notice,
	TFile,
} from 'obsidian';

import {
	parse as dateParse,
	format,
	differenceInMinutes,
	getWeek,
} from 'date-fns'; // Add date-fns imports needed here
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';
import {DayLogData, PeriodData, TimeEntryData} from "./types";


// --- Constants ---

export const monthOrder: string[] = [
	'January', 'February', 'March', 'April', 'May', 'June',
	'July', 'August', 'September', 'October', 'November', 'December',
];

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

/**
 * Calculates the total logged minutes for a given month's data.
 */
export function calculateMonthTotalMinutes(monthData: DayLogData): number {
	let totalMinutes = 0;
	Object.keys(monthData).forEach((dateStr) => {
		const baseDate = parseDate(dateStr);
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
}

/**
 * Groups day entries within a month by week number.
 */
export function groupDaysIntoWeeks(monthData: DayLogData): {
	weekNumber: number;
	days: { dateStr: string; entries: TimeEntryData[] }[];
}[] {
	const grouped: {
		[weekNum: number]: { dateStr: string; entries: TimeEntryData[] }[];
	} = {};

	// Sort days chronologically first before grouping
	const sortedDays = Object.keys(monthData).sort((a, b) => {
		const dateA = parseDate(a);
		const dateB = parseDate(b);
		// Handle potential null dates, though ideally data is clean
		return (dateA?.getTime() || 0) - (dateB?.getTime() || 0);
	});

	sortedDays.forEach((dateStr) => {
		const entries = monthData[dateStr];
		const baseDate = parseDate(dateStr);
		if (baseDate && entries && entries.length > 0) {
			// Use weekStartsOn: 1 for ISO standard (Monday)
			const weekOfYear = getWeek(baseDate, { weekStartsOn: 1 });
			if (!grouped[weekOfYear]) {
				grouped[weekOfYear] = [];
			}
			// Add the day's data to the correct week
			grouped[weekOfYear].push({ dateStr, entries });
		}
	});

	// Convert grouped object to array and sort weeks descending
	return Object.entries(grouped)
		.map(([weekNum, days]) => ({
			weekNumber: parseInt(weekNum, 10),
			days: days.sort((a, b) => { // Sort days within week descending for display
				const dateA = parseDate(a.dateStr);
				const dateB = parseDate(b.dateStr);
				return (dateB?.getTime() || 0) - (dateA?.getTime() || 0);
			}),
		}))
		.sort((a, b) => b.weekNumber - a.weekNumber); // Sort weeks descending
}

/**
 * Displays an error message within a given HTML element, clearing the element first.
 * Useful for showing errors directly in Obsidian's preview where a code block failed.
 * @param el The HTMLElement to display the error in.
 * @param error The error object or message string.
 * @param source Optional source string to include in the error display.
 */
export function displayErrorInElement(
	el: HTMLElement,
	error: Error | string,
	source?: string,
): void {
	el.empty();
	el.addClass('time-log-error');
	const errorMsg = error instanceof Error ? error.message : error;
	const text = `Error rendering time-log:\n${errorMsg}${
		source ? `\n\nSource:\n${source}` : ''
	}`;

	const errorEl = el.createEl('pre');
	errorEl.createEl('code', { text });

	// Basic styling for visibility
	errorEl.style.backgroundColor = 'var(--background-modifier-error)';
	errorEl.style.color = 'var(--text-error)';
	errorEl.style.padding = '10px';
	errorEl.style.borderRadius = '4px';
	errorEl.style.whiteSpace = 'pre-wrap'; // Ensure source wraps
}

/**
 * Updates the content of a specific code block within a Markdown file.
 * Uses the MarkdownPostProcessorContext to identify the block's boundaries.
 * @param app Obsidian App instance.
 * @param ctx The context object provided to the code block processor.
 * @param newContent The new string content to write into the code block.
 * @throws Error if the file cannot be found, read, or modified, or if section info is missing.
 */
export async function updateCodeBlockContent(
	app: App,
	ctx: MarkdownPostProcessorContext,
	newContent: string,
): Promise<void> {
	const filePath = ctx.sourcePath;
	const file = app.vault.getAbstractFileByPath(filePath);

	if (!(file instanceof TFile)) {
		const msg = `Source file not found: ${filePath}`;
		console.error(msg);
		new Notice(`Error: Could not find source file ${filePath}`);
		throw new Error(msg);
	}

	try {
		const fileContent = await app.vault.read(file);
		const fileLines = fileContent.split('\n');

		const sectionInfo = ctx.getSectionInfo(ctx.el);
		if (!sectionInfo) {
			const msg = `Could not get section info for block: ${filePath}`;
			console.error(msg);
			new Notice('Error: Could not get section info to update block.');
			throw new Error(msg);
		}
		const startLine = sectionInfo.lineStart;
		const endLine = sectionInfo.lineEnd;

		// Replace the old block content with the new content
		// Keep the ```time-log line, replace content lines, keep the closing ```
		const newFileLines = [
			...fileLines.slice(0, startLine + 1),
			newContent.trim(),
			...fileLines.slice(endLine),
		];

		const newFileContent = newFileLines.join('\n');

		await app.vault.modify(file, newFileContent);
		console.log('Code block updated successfully in:', filePath);
	} catch (error) {
		console.error(
			'Error updating code block content in file:',
			filePath,
			error,
		);
		new Notice(`Error saving changes: ${error.message}`);
		throw error;
	}
}

export function generatePdfData(
	monthName: string,
	monthData: DayLogData,
    projectName: string,
    period: PeriodData,
): {
    header: string[];
    body: any[][];
    monthTotal: string;
    projectName: string;
    period: PeriodData;
} {
	const header = ['Date', 'From', 'To', 'Break', 'Duration', 'Note'];
	const body: any[][] = [];

	Object.entries(monthData).forEach(([dateStr, entries]) => {
		const baseDate = parseDate(dateStr);
		if (!baseDate) return;

		entries.forEach((entry) => {
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

			body.push([
				dateStr,
				entry.from,
				entry.to,
				entry.break || '',
				durationStr,
				entry.note || '',
			]);
		});
	});

    const monthTotalMinutes = calculateMonthTotalMinutes(monthData);
    const monthTotal = formatMinutes(monthTotalMinutes);

    return {
        header,
        body,
        monthTotal,
        projectName,
        period,
    };
}
