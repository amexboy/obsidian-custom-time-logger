import {forwardRef, useMemo,} from 'react';
import {
	calculateMonthTotalMinutes,
	formatMinutes,
	groupDaysIntoWeeks,
	parseDate,
	parseDurationToMinutes,
	parseTime,
} from './helpers';
import {DayLogData, PeriodData} from './types';
import {differenceInMinutes} from 'date-fns';
import 'jspdf-autotable';
import styled from 'styled-components';

// Wrapper to center the A4 container
const CenterWrapper = styled.div`
	display: flex;
	justify-content: center;
	align-items: flex-start;
	width: 100%;
`;

// Styled Components with adjusted sizing for A4 proportions
const A4Container = styled.div`
	width: 210mm;
	height: 297mm;
	background-color: white;
	box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
	overflow: hidden; /* Prevent content from overflowing */
	margin: 0 auto; /* Center the container */
`;

const ReportContainer = styled.div`
	font-family: 'Arial', sans-serif;
	padding: 10mm; /* Use mm for consistent A4 proportions */
	color: #333;
	box-sizing: border-box; /* Include padding in width calculation */
	width: 100%;
`;

const Header = styled.div`
	text-align: start;
	margin-bottom: 10mm;
`;

const Title = styled.h1`
	font-size: 18pt;
	color: #0056b3;
	margin: 0;
`;

const Period = styled.p`
	font-size: 12pt;
	margin-top: 5pt;
`;

const WeekSection = styled.div`
	margin-bottom: 8mm;
`;

const WeekTitle = styled.h2`
	font-size: 14pt;
	color: #0056b3;
	margin-bottom: 5pt;
`;

const Table = styled.table`
	width: 100%;
	border-collapse: collapse;
	margin-bottom: 5mm;
	table-layout: fixed; /* Fixed layout to control column widths */
`;

const TableHead = styled.thead`
	background-color: #f2f2f2;
`;

const TableRow = styled.tr`
	&:nth-child(even) {
		background-color: #f9f9f9;
	}
`;

const TableHeader = styled.th`
	padding: 8pt;
	text-align: left;
	border-bottom: 1px solid #ddd;
	font-weight: bold;
	font-size: 10pt;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

const TableCell = styled.td`
	padding: 8pt;
	text-align: left;
	border-bottom: 1px solid #ddd;
	font-size: 10pt;
	overflow: hidden;
	text-overflow: ellipsis;
	white-space: nowrap;
`;

// Define column widths
const DateColumn = styled(TableCell)`
	width: 15%;
`;

const TimeColumn = styled(TableCell)`
	width: 12%;
`;

const BreakColumn = styled(TableCell)`
	width: 10%;
`;

const DurationColumn = styled(TableCell)`
	width: 15%;
`;

const NoteColumn = styled(TableCell)`
	width: 36%;
`;

// Header versions
const DateHeader = styled(TableHeader)`
	width: 15%;
`;

const TimeHeader = styled(TableHeader)`
	width: 12%;
`;

const BreakHeader = styled(TableHeader)`
	width: 10%;
`;

const DurationHeader = styled(TableHeader)`
	width: 25%;
`;

const NoteHeader = styled(TableHeader)`
	width: 25%;
`;

const Total = styled.div`
	text-align: right;
	font-weight: bold;
	font-size: 20pt;
	margin-bottom: 10mm;
`;

const Footer = styled.div`
	border-top: 2px solid #0056b3;
	padding-top: 10px;
	font-size: 20px;
	color: #777;
	display: flex;
	flex-direction: column;
	align-items: flex-end;
`;
const SignatureBox = styled.div`
	border-bottom: 1px solid #777;
	width: 200px;
	height: 100px;
	margin-top: 5px;
	display: flex;
	justify-content: center;
	align-items: center;
`;

const SignatureImage = () => {
	return <img height="100%" alt="Signature"
				src="data:image/png;base64,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" />
};


const FooterText = styled.div`
	text-align: left;
`;

interface TimeLogReportProps {
	monthName: string;
	monthData: DayLogData;
	projectName: string;
	period: PeriodData;
	onGeneratePdf?: () => void;
}

const TimeLogReport = forwardRef<HTMLDivElement, TimeLogReportProps>(
	({monthName, monthData, projectName, period}, reportRef) => {
		const weeks = useMemo(() => groupDaysIntoWeeks(monthData), [monthData]);
		const totalMonthMinutes = useMemo(
			() => calculateMonthTotalMinutes(monthData),
			[monthData],
		);
		const formattedTotal = formatMinutes(totalMonthMinutes);

		return (
			<CenterWrapper>
				<A4Container>
					<ReportContainer ref={reportRef}>
						<Header>
							<Title>Time Log Report - {monthName}</Title>
							<Period>
								{period.from} - {period.to}
							</Period>
						</Header>

						{weeks.map((week) => (
							<WeekSection key={week.weekNumber}>
								<WeekTitle>Week {week.weekNumber}</WeekTitle>
								<Table>
									<TableHead>
										<TableRow>
											<DateHeader>Date</DateHeader>
											<TimeHeader>From</TimeHeader>
											<TimeHeader>To</TimeHeader>
											<BreakHeader>Break</BreakHeader>
											<DurationHeader>Duration</DurationHeader>
											<NoteHeader>Note</NoteHeader>
										</TableRow>
									</TableHead>
									<tbody>
									{week.days.map((day) =>
										day.entries.map((entry, index) => {
											const baseDate = parseDate(day.dateStr);
											const startTime =
												baseDate && parseTime(baseDate, entry.from);
											const endTime = baseDate && parseTime(baseDate, entry.to);
											const breakMinutes =
												parseDurationToMinutes(entry.break);

											let durationMinutes = 0;
											let durationStr = 'Invalid';

											if (startTime && endTime && endTime > startTime) {
												durationMinutes =
													differenceInMinutes(endTime, startTime) -
													breakMinutes;
												durationStr = formatMinutes(durationMinutes);
											} else if (startTime && endTime) {
												durationStr = 'Negative/Zero';
											}

											return (
												<TableRow key={index}>
													<DateColumn>{day.dateStr}</DateColumn>
													<TimeColumn>{entry.from}</TimeColumn>
													<TimeColumn>{entry.to}</TimeColumn>
													<BreakColumn>{entry.break || ''}</BreakColumn>
													<DurationColumn>{durationStr}</DurationColumn>
													<NoteColumn>{entry.note || ''}</NoteColumn>
												</TableRow>
											);
										}),
									)}
									</tbody>
								</Table>
							</WeekSection>
						))}

						<Total>Total: {formattedTotal}</Total>

						<Footer>
							<FooterText>Amanuel Nega Mekonnen</FooterText>
							<SignatureBox>
								<SignatureImage/>
							</SignatureBox>
							<FooterText>{new Date().toLocaleDateString()}</FooterText>
						</Footer>
					</ReportContainer>
				</A4Container>
			</CenterWrapper>
		);
	},
);

TimeLogReport.displayName = 'TimeLogReport';
export default TimeLogReport;
