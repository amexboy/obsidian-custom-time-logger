import {MarkdownPostProcessorContext, Plugin, TFile} from 'obsidian';
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
		newData: TimeLogRootData
	) {
		const filePath = ctx.sourcePath;
		const file = this.app.vault.getAbstractFileByPath(filePath);

		if (!(file instanceof TFile)) {
			console.error("Source file not found or is not a TFile:", filePath);
			throw new Error("Source file not found.");
		}

		try {
			const fileContent = await this.app.vault.read(file);
			const fileLines = fileContent.split('\n');

			// --- Find the boundaries of the specific time-log block ---
			// This is tricky and relies on line numbers from ctx or careful parsing
			const sectionInfo = ctx.getSectionInfo(ctx.el);
			if (!sectionInfo) {
				throw new Error("Could not get section info to update block.");
			}
			const startLine = sectionInfo.lineStart;
			const endLine = sectionInfo.lineEnd;

			// --- Convert the new data back to YAML ---
			// Ensure consistent formatting (indentation, etc.)
			const newYamlSource = yamlStringify(newData, {indent: 2}); // Adjust options as needed

			// --- Replace the old block content with the new YAML ---
			const newFileLines = [
				...fileLines.slice(0, startLine + 1), // Keep lines before block + the ```time-log line
				newYamlSource.trim(), // Add the new YAML content
				...fileLines.slice(endLine), // Keep lines after the block (including ```)
			];

			const newFileContent = newFileLines.join('\n');

			// --- Write the modified content back to the file ---
			await this.app.vault.modify(file, newFileContent);
			console.log("Time log block updated successfully in:", filePath);

		} catch (error) {
			console.error("Error updating time-log block in file:", filePath, error);
			throw error; // Re-throw to indicate failure
		}
	}


	// --- Updated Post Processor ---
	async processTimeLogBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	) {
		const sourcePath = ctx.sourcePath; // Use sourcePath for unique identification

		try {
			const data: TimeLogRootData = yamlParse(source);

			// --- Create the update function specific to this block ---
			// Use useCallback or bind if needed, passing necessary context
			const updateDataForThisBlock = async (newData: TimeLogRootData) => {
				// !! Important: This function needs access to 'ctx'
				// or the necessary info like sourcePath and line numbers.
				// Passing 'ctx' directly might be okay if its lifetime matches,
				// but passing specific info (sourcePath, getSectionInfo) might be safer.
				await this.updateSourceFile(ctx, newData);

				// Optional: Trigger a re-render if needed, although modifying
				// the file might trigger Obsidian's own refresh mechanisms.
			};


			el.empty();
			el.addClass('time-log-react-container'); // Add class for potential cleanup

			// --- Manage React Root ---
			// Unmount existing root for this element if it exists
			if (this.roots.has(sourcePath + el.offsetTop)) { // Use offsetTop for uniqueness on page
				this.roots.get(sourcePath + el.offsetTop)?.unmount();
			}

			const root = createRoot(el);
			this.roots.set(sourcePath + el.offsetTop, root); // Store the root

			root.render(
				createElement(TimeLogView, {
					data,
					// Pass the update function (or undefined if saving isn't implemented)
					// updateSourceData: updateDataForThisBlock // Uncomment when ready
				})
			);

		} catch (e) {
			console.error(`Error processing time-log block (${sourcePath}):`, e);
			// Unmount if error occurred during render setup
			if (this.roots.has(sourcePath + el.offsetTop)) {
				this.roots.get(sourcePath + el.offsetTop)?.unmount();
				this.roots.delete(sourcePath + el.offsetTop);
			}
			el.empty();
			const errorEl = el.createEl('pre', { /* ... error display ... */});
			// ... error styling ...
		}
	}

	onunload() {
		console.log('Unloading Time Log Renderer Plugin');
		// Unmount all stored React roots
		this.roots.forEach((root) => {
			try {
				root.unmount();
			} catch (e) {
				console.error("Error unmounting React root:", e);
			}
		});
		this.roots.clear(); // Clear the map
		// Remove the class if you were using it for global cleanup (less reliable)
		// document.querySelectorAll('.time-log-react-container').forEach(...)
	}
}
