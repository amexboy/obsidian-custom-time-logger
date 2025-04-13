import React, {useCallback, useMemo, useRef, useState,} from 'react';
import {MonthSectionProps, PeriodData} from './types';
import {calculateMonthTotalMinutes, formatMinutes, groupDaysIntoWeeks,} from './helpers';
import {WeekSection} from './weekSection';
import TimeLogReport from './TimeLogReport'; // Import the new component
import 'jspdf-autotable';
import styled from 'styled-components';
import {jsPDF} from "jspdf";

// Styled Components for the Dialog
const DialogOverlay = styled.div`
	position: fixed;
	top: 0;
	left: 0;
	width: 100%;
	height: 100%;
	background-color: rgba(0, 0, 0, 0.5); /* Semi-transparent background */
	display: flex;
	justify-content: center;
	align-items: center;
	z-index: 1000; /* Ensure it's on top */
`;

const DialogContent = styled.div`
	background-color: white;
	padding: 20px;
	border-radius: 8px;
	box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
	width: 80%; /* Adjust width as needed */
	max-width: 800px;
	overflow: auto; /* Enable scrolling if content overflows */
	max-height: 90%;
`;

const CloseButton = styled.button`
	background-color: #ddd;
	border: none;
	padding: 8px 16px;
	border-radius: 4px;
	cursor: pointer;
	margin-top: 20px;
	margin-left: auto;
`;

export const MonthSection: React.FC<MonthSectionProps> = ({monthName, monthData, context, projectName}) => {
	const [isExpanded, setIsExpanded] = useState(
		context.allExpanded || context.currentMonth === monthName,
	);
	const toggleCollapse = () => setIsExpanded(!isExpanded);

	const totalMonthMinutes = useMemo(
		() => calculateMonthTotalMinutes(monthData),
		[monthData],
	);
	const formattedTotal = formatMinutes(totalMonthMinutes);

	const weeks = useMemo(() => groupDaysIntoWeeks(monthData), [monthData]);

	const period: PeriodData = useMemo(() => {
		// Extract all the keys (dates) from the monthData object
		const dates = Object.keys(monthData);

		// Sort the dates to ensure they are in chronological order
		const sortedDates = dates.sort((a, b) => {
			const [dayA, monthA, yearA] = a.split('-').map(Number);
			const [dayB, monthB, yearB] = b.split('-').map(Number);

			return new Date(yearA, monthA - 1, dayA).getTime() - new Date(yearB, monthB - 1, dayB).getTime();
		});

		// Get the first and last dates from the sorted list
		const from = sortedDates[0]; // First date
		const to = sortedDates[sortedDates.length - 1]; // Last date

		return { from, to };
	}, [monthData]);

	const [isDialogOpen, setIsDialogOpen] = useState(false);

	const openDialog = () => setIsDialogOpen(true);
	const closeDialog = () => setIsDialogOpen(false);

	// useRef to hold the TimeLogReport component
	const reportRef = useRef<HTMLDivElement>(null);
	const generatePdf = useCallback(() => {
		if (reportRef.current) {
			const doc = new jsPDF('p', 'pt', 'a4'); // Portrait, points, A4 size
			doc.html(reportRef.current, {
				callback: function (doc) {
					doc.save(`TimeLogReport-${monthName}.pdf`);
				},
				x: 20, // Left margin
				y: 20, // Top margin
				width: 170, // Content width in mm (A4 width is 210mm, leaving 20mm margins on each side)
				windowWidth: 800, // Ensures proper scaling of the content
			});
		}
	}, [monthName]);

	const handleExportPdf = useCallback((event: MouseEvent) => {
		event.stopPropagation()

		openDialog();
	}, [monthName, monthData, projectName, period]);

	if (weeks.length === 0) return null;

	return (
		<div className="time-log-month">
			<div onClick={toggleCollapse} className="time-log-section-header">
				<span className="time-log-month-name">{monthName}</span>
				<span className="time-log-month-total">{formattedTotal}
					&nbsp;
					<button
						onClick={handleExportPdf}
						className="time-log-export-button icon-button"
						aria-label={`Export ${monthName} to PDF`}
						style={{marginLeft: 'auto'}}
					>
					⎙
				</button>
				</span>
				<span
					className={`time-log-collapse-indicator-month ${
						isExpanded ? 'expanded' : 'collapsed'
					}`}
				>
          {isExpanded ? '▼' : '▶'}

        </span>
			</div>
			{/* Dialog Box */}
			{isDialogOpen && (
				<DialogOverlay>
					<DialogContent>
						<div>
							<button onClick={generatePdf}>Generate PDF</button>
							<CloseButton onClick={closeDialog}>Close</CloseButton>
						</div>
						<TimeLogReport
							monthName={monthName}
							monthData={monthData}
							projectName={projectName}
							period={period}
							ref={reportRef}
						/>
					</DialogContent>
				</DialogOverlay>
			)}
			{isExpanded && (
				<div className="time-log-month-content">
					{weeks.map(({weekNumber, days}) => (
						<WeekSection
							key={`${monthName}-${weekNumber}`}
							weekNumber={weekNumber}
							days={days}
							context={context}
						/>
					))}
				</div>
			)}
		</div>
	);
};
