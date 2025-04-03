import { App, Plugin, MarkdownPostProcessorContext } from 'obsidian';
import { parse } from 'yaml';
import {
	parse as dateParse,
	format,
	differenceInMinutes,
	addMinutes,
	getWeek,
} from 'date-fns';

// Import the React component and interfaces
import { TimeLogView } from './src/components'; // Adjust path if needed
import type { TimeLogRootData } from './src/components';
import {createRoot, Root} from "react-dom/client";
import {createElement} from "react"; // Import type if needed

export default class TimeLoggerPlugin extends Plugin {
	root: Root | null = null;
	async onload() {
		console.log('Loading Time Log Renderer Plugin (React)');

		this.registerMarkdownCodeBlockProcessor(
			'time-log',
			this.processTimeLogBlock.bind(this),
		);
	}

	// --- Keep Helper Functions Here (or move to a dedicated utils file) ---
	parseDurationToMinutes(durationStr?: string): number {
		if (!durationStr) return 0;
		let totalMinutes = 0;
		const hourMatch = durationStr.match(/(\d+(\.\d+)?)\s*h/);
		const minMatch = durationStr.match(/(\d+)\s*m/);
		if (hourMatch) totalMinutes += parseFloat(hourMatch[1]) * 60;
		if (minMatch) totalMinutes += parseInt(minMatch[1], 10);
		return Math.round(totalMinutes);
	}

	parseTime(baseDate: Date, timeStr: string): Date | null {
		try {
			const [hour, minute] = timeStr.split(':').map(Number);
			if (isNaN(hour) || isNaN(minute)) return null;
			const newDate = new Date(baseDate);
			newDate.setHours(hour, minute, 0, 0);
			return newDate;
		} catch (e) {
			console.error('Error parsing time:', timeStr, e);
			return null;
		}
	}

	parseDate(dateStr: string): Date | null {
		try {
			return dateParse(dateStr, 'dd-MM-yyyy', new Date());
		} catch (e) {
			console.error('Error parsing date:', dateStr, e);
			return null;
		}
	}

	formatMinutes(totalMinutes: number): string {
		if (totalMinutes < 0) totalMinutes = 0;
		const hours = Math.floor(totalMinutes / 60);
		const minutes = totalMinutes % 60;
		let durationStr = '';
		if (hours > 0) durationStr += `${hours}h `;
		if (minutes > 0) durationStr += `${minutes}m`;
		return durationStr.trim() || '0m';
	}

	// --- Updated Post Processor ---
	async processTimeLogBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	) {
		try {
			const data: TimeLogRootData = parse(source);

			// Bundle helper functions to pass as props
			const helpers = {
				parseDurationToMinutes: this.parseDurationToMinutes,
				parseTime: this.parseTime,
				parseDate: this.parseDate,
				formatMinutes: this.formatMinutes,
			};

			// Clear the container and render the React component
			el.empty(); // Ensure the container is empty before rendering
			// For React 18+:
			this.root = createRoot(el);
			this.root.render(createElement(TimeLogView, { data, helpers }));

			// Add a class to the container for styling if needed (optional)
			el.addClass('time-log-react-container');

		} catch (e) {
			console.error('Error processing time-log block:', e);
			el.empty();
			// Keep error display simple or create an Error React component
			const errorEl = el.createEl('pre', {
				text: `Error rendering time-log:\n${e.message}\n\n${e.stack}`,
				cls: 'time-log-error',
			});
			errorEl.style.whiteSpace = 'pre-wrap'; // Ensure wrapping
			errorEl.style.color = 'var(--text-error)';
		}
	}

	onunload() {
		console.log('Unloading Time Log Renderer Plugin');
		// --- Important: Unmount React components ---
		// Find all containers rendered by this plugin and unmount
		document
			.querySelectorAll('.time-log-react-container')
			.forEach((container) => {
				this.root?.unmount()
			});
	}
}
