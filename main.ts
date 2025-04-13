import {
	MarkdownPostProcessorContext,
	Plugin,
	Notice,
} from 'obsidian';
import { parse as yamlParse, stringify as yamlStringify } from 'yaml';
import { createRoot, Root } from 'react-dom/client';
import { createElement } from 'react';

import type { TimeLogRootData } from './src/components';
import { TimeLogView } from './src/components';
import {
	displayErrorInElement,
	updateCodeBlockContent,
} from './src/helpers'; // Import new helpers

export default class TimeLoggerPlugin extends Plugin {
	private roots: Map<string, Root> = new Map();

	async onload() {
		console.log('Loading Time Log Renderer Plugin (React)');
		this.registerMarkdownCodeBlockProcessor(
			'time-log',
			this.processTimeLogBlock.bind(this),
		);
	}

	/**
	 * Converts data to YAML and updates the specific code block in the source file.
	 */
	async updateSourceFile(
		ctx: MarkdownPostProcessorContext,
		newData: TimeLogRootData,
	): Promise<void> {
		try {
			// Ensure consistent formatting and avoid alias nodes by default
			const newYamlSource = yamlStringify(newData, {
				indent: 2,
				aliasDuplicateObjects: false,
			});

			await updateCodeBlockContent(this.app, ctx, newYamlSource);
			// Success notice could be added here if desired, but updateCodeBlockContent logs success
		} catch (error) {
			// Error handling (including Notice) is primarily done within updateCodeBlockContent
			// or potentially here if yamlStringify fails (less likely)
			console.error('Failed to prepare or save time log update:', error);
			// Optionally, add a more specific Notice here if the error wasn't from file I/O
			if (!(error instanceof Error && error.message.includes('Source file not found')) &&
				!(error instanceof Error && error.message.includes('Could not get section info'))) {
				new Notice(`Error processing time log update: ${error.message}`);
			}
			throw error; // Re-throw to indicate failure to the caller (React component)
		}
	}

	async processTimeLogBlock(
		source: string,
		el: HTMLElement,
		ctx: MarkdownPostProcessorContext,
	) {
		// Using offsetTop might be brittle if unrelated content above changes height.
		// Consider more robust unique key generation if issues arise.
		const uniqueKey = `${ctx.sourcePath}|${el.offsetTop}`;

		try {
			const data: TimeLogRootData = yamlParse(source);

			const updateDataForThisBlock = async (newData: TimeLogRootData) => {
				try {
					await this.updateSourceFile(ctx, newData);
				} catch (updateError) {
					// Error handling is done within updateSourceFile (including Notice)
					console.error('Update callback failed:', updateError);
					// Potentially trigger UI feedback in the React component if possible
				}
			};

			el.empty();
			el.addClass('time-log-react-container');

			// Unmount existing root for this specific element if it exists
			if (this.roots.has(uniqueKey)) {
				this.roots.get(uniqueKey)?.unmount();
				this.roots.delete(uniqueKey);
			}

			const root = createRoot(el);
			this.roots.set(uniqueKey, root);

			root.render(
				createElement(TimeLogView, {
					data,
					updateSourceData: updateDataForThisBlock,
				}),
			);
		} catch (e) {
			console.error(
				`Error processing time-log block (${ctx.sourcePath}):`,
				e,
			);

			// Cleanup React root on error
			if (this.roots.has(uniqueKey)) {
				this.roots.get(uniqueKey)?.unmount();
				this.roots.delete(uniqueKey);
			}

			// Use helper to display error
			displayErrorInElement(el, e, source);
		}
	}

	onunload() {
		console.log('Unloading Time Log Renderer Plugin');
		this.roots.forEach((root, key) => { // Added key for logging clarity
			try {
				root.unmount();
				console.log('Unmounted root for key:', key);
			} catch (e) {
				console.error('Error unmounting React root for key:', key, e);
			}
		});
		this.roots.clear();
	}
}
