import {MarkdownPostProcessorContext, Plugin, TFile, Notice} from 'obsidian';
import {parse as yamlParse, stringify as yamlStringify} from 'yaml'; // Need stringify

import type {TimeLogRootData} from './src/components';
import {TimeLogView} from './src/components';
import {createRoot, Root} from "react-dom/client";
import {createElement} from "react";
import {parseDate, parseDurationToMinutes} from "./src/helpers";

export default class TimeLoggerPlugin extends Plugin {
	// Store roots mapped by source path to handle multiple blocks/files
	private roots: Map<string, Root> = new Map();

	async onload() {
		console.log('Loading Time Log Renderer Plugin (React)');
		this.registerMarkdownCodeBlockProcessor(
			'time-log',
			this.processTimeLogBlock.bind(this),
		);
	}
	// --- Function to Update Source File (Needs careful implementation) ---
	async updateSourceFile(
		ctx: MarkdownPostProcessorContext,
		newData: TimeLogRootData,
	): Promise<void> { // Added return type promise
		const filePath = ctx.sourcePath;
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			console.error('Source file not found or is not a TFile:', filePath);
			new Notice(`Error: Could not find source file ${filePath}`);
			throw new Error('Source file not found.');
		}

		try {
			const fileContent = await this.app.vault.read(file);
			const fileLines = fileContent.split('\n');

			// --- Find the boundaries of the specific time-log block ---
			// This is tricky and relies on line numbers from ctx or careful parsing
			const sectionInfo = ctx.getSectionInfo(ctx.el);
			if (!sectionInfo) {
				console.error('Could not get section info for block:', filePath);
				new Notice('Error: Could not get section info to update block.');
				throw new Error('Could not get section info to update block.');
			}
			const startLine = sectionInfo.lineStart;
			const endLine = sectionInfo.lineEnd;

			// --- Convert the new data back to YAML ---
			// Ensure consistent formatting and avoid alias nodes by default
			const newYamlSource = yamlStringify(newData, {
				indent: 2,
				aliasDuplicateObjects: false,
			});

			// --- Replace the old block content with the new YAML ---
			const newFileLines = [
				...fileLines.slice(0, startLine + 1),
				newYamlSource.trim(),
				...fileLines.slice(endLine),
			];

			const newFileContent = newFileLines.join('\n');

			// --- Write the modified content back to the file ---
			await this.app.vault.modify(file, newFileContent);
			console.log("Time log block updated successfully in:", filePath);

		} catch (error) {
			console.error('Error updating time-log block in file:', filePath, error);
			new Notice(`Error saving time log: ${error.message}`);
			throw error; // Re-throw to indicate failure
		}
	}


	// --- Updated Post Processor ---
	async processTimeLogBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	) {
		// Use a combination of sourcePath and element position for uniqueness
		// offsetTop is simple but might change on unrelated edits; consider alternatives if needed
		const uniqueKey = `${ctx.sourcePath}|${el.offsetTop}`;

		try {
			const data: TimeLogRootData = yamlParse(source);

			// --- Create the update function specific to this block ---
			// Use useCallback or bind if needed, passing necessary context
			const updateDataForThisBlock = async (newData: TimeLogRootData) => {
				try {
					// Call the main update function with the captured context
				await this.updateSourceFile(ctx, newData);
					// Optional: Add success feedback if needed (e.g., via Notice)
				} catch (updateError) {
					// Error handling is done within updateSourceFile (including Notice)
					console.error('Update callback failed:', updateError);
					// Potentially trigger UI feedback in the React component if possible
				}
			};

			el.empty(); // Clear any previous content/errors
			el.addClass('time-log-react-container'); // Add class for styling/cleanup

			// --- Manage React Root ---
			// Unmount existing root for this specific element if it exists
			if (this.roots.has(uniqueKey)) {
				console.log('Unmounting existing root for:', uniqueKey);
				this.roots.get(uniqueKey)?.unmount();
				this.roots.delete(uniqueKey); // Remove old root from map
			}

			const root = createRoot(el);
			this.roots.set(uniqueKey, root); // Store the new root

			root.render(
				createElement(TimeLogView, {
					data,
					updateSourceData: updateDataForThisBlock, // Pass the callback
				}),
			);

		} catch (e) {
			console.error(
				`Error processing time-log block (${ctx.sourcePath}):`,
				e,
			);

			// --- Cleanup on Error ---
			// Unmount if error occurred during render setup for this specific block
			if (this.roots.has(uniqueKey)) {
				this.roots.get(uniqueKey)?.unmount();
				this.roots.delete(uniqueKey);
			}
			el.empty(); // Clear potentially broken rendering attempt
			el.addClass('time-log-error'); // Add error class for styling
			const errorEl = el.createEl('pre');
			errorEl.createEl('code', {
				text: `Error rendering time-log:\n${e.message || e}\n\nSource:\n${source}`,
			});
			// Add some basic styling for visibility
			errorEl.style.backgroundColor = 'var(--background-modifier-error)';
			errorEl.style.color = 'var(--text-error)';
			errorEl.style.padding = '10px';
			errorEl.style.borderRadius = '4px';
			errorEl.style.whiteSpace = 'pre-wrap'; // Ensure source wraps
		}
	}

	onunload() {
		console.log('Unloading Time Log Renderer Plugin');
		// Unmount all stored React roots
		this.roots.forEach((root) => {
			try {
				root.unmount();
				console.log('Unmounted root for key:', key);
			} catch (e) {
				console.error("Error unmounting React root:", e);
			}
		});
		this.roots.clear(); // Clear the map
		// Remove the class if you were using it for global cleanup (less reliable)
		// document.querySelectorAll('.time-log-react-container').forEach(...)
	}
}
