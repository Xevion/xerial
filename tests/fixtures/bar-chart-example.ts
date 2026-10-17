/**
 * The schedule table from "Bar Chart Example for RC.xlsx", as the sheet displays
 * it: Box # | Box Title | Box Color | Text Color | Start | Finish. The Box # cells
 * are numbers under custom formats ("Box "00, "Baseline "00), so the displayed
 * text is what carries the row type. The pre-numbered empty slots (Box 16–31) are
 * omitted.
 */
export const EXAMPLE_RANGE = { start: "2027-01-01", finish: "2028-12-31" } as const;

export const EXAMPLE_ROWS: readonly (readonly (string | null)[])[] = [
	[
		"Box 01",
		"Building 1 Construction (5.5 mths), Commissioning (6 wks), Soak Time(3 wks)",
		"Yellow",
		"Black",
		"2027-01-01",
		"2027-08-31",
	],
	[
		"Box 02",
		"Building 2 Construction (4.5 mths), Commissioning (6 wks), Soak Time(3 wks)",
		"Yellow",
		"Black",
		"2027-08-31",
		"2028-03-31",
	],
	[
		"Box 03",
		"Building 3 Construction (4.5 mths), Commissioning (6 wks), Soak Time(3 wks)",
		"Yellow",
		"Black",
		"2028-03-31",
		"2028-07-31",
	],
	["V-Bar 01", "Outage", "Red", "White", "2027-12-05", null],
	["V-Bar 02", "Operation Start", "Red", "White", "2028-03-15", null],
	["V-Bar 03", "Substantial Completion", "Red", "White", "2028-07-10", null],
	["V-Curt 01", "Olympic Games", "Yellow", "Black", "2028-07-01", "2028-07-31"],
	[
		"Box 04",
		"Building 1 Steel & Exterior Construction",
		"Med Blue",
		"White",
		"2027-01-01",
		"2027-06-05",
	],
	["Baseline 04", null, "Yellow", null, "2027-01-01", "2027-05-31"],
	["Box 05", "Building 1 Interior Framing", "Dark Blue", "White", "2027-02-01", "2027-07-10"],
	["Box 06", "Building 1 Equipment Installation", "Dark Blue", "White", "2027-03-01", "2027-07-31"],
	[
		"Box 07",
		"Building 1 Electrical Installation",
		"Dark Blue",
		"White",
		"2027-04-01",
		"2027-06-30",
	],
	["Box 08", "Building 1 Architectural Finishes", "Dark Blue", "White", "2027-05-01", "2027-07-10"],
	[
		"Box 09",
		"Building 1 Perm Power Install & Energize",
		"Dark Blue",
		"White",
		"2027-06-01",
		"2027-07-31",
	],
	["Box 10", "B1 Float", null, null, "2027-08-01", "2027-08-15"],
	["Box 11", "Building 1 Systems Start-up", "Yellow", "Black", "2027-08-15", "2027-09-30"],
	["Box 12", "Building 1 System Testing", "Green", "Black", "2027-08-01", "2027-12-15"],
	["Box 13", "Building 1 Operations Testing", "Dark Blue", "White", "2027-12-01", "2028-01-31"],
	["Box 14", "B1 Pen Test", "Med Blue", "White", "2028-02-01", "2028-02-15"],
	["Box 15", "Building 1 Testing & Commissioning", null, null, null, null],
];
