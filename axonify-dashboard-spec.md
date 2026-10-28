# Axonify Data Connect Dashboard: Page-by-Page Spec

Source: Power BI report "Axonify-CSM-PowerBI-Dash", reviewed 22 Oct 2026 (data refreshed 21 Oct 2026). Values below are what the report showed with Client = "emirates" and the default date range, so treat them as sample data for mock-ups, not fixed requirements.

Purpose for the Next.js build: recreate this report as a set of routes inside a Next.js site. Each Power BI page becomes a route, each visual becomes a component, and the shared header, slicers and styling live in a layout.

---

## 1. Glance view

| # | Page (Power BI name) | Suggested route | Question it answers | KPI count | Main visuals |
|---|---|---|---|---|---|
| 1 | Homepage | `/` | What is the overall health, and where do I go next? | 5 | Nav tiles, 2 line charts |
| 2 | Engagement | `/engagement` | Are people showing up and how often? | 5 | Dual-axis line chart, team table, team tree slicer |
| 3 | Knowledge | `/knowledge` | Is knowledge and confidence growing? | 5 | Bar chart by topic, topic tree slicer, frequency-bucket table |
| 4 | Content | `/content` | What content exists and how are learners progressing in it? | 5 | Stacked bar x2, subject list slicer |
| 5 | Usage | `/usage` | How, when and on what device do people use the platform? | 6 | Donut, bar chart, hourly column chart, platform slicer |
| 6 | Team Performance | `/teams` | Which teams are strong, which need attention? | 0 (chart summary) | Status distribution bar, 2 ranked tables, team slicer |
| 7 | Topic Performance & Content Coverage (homepage tile: "Topic Deep Dive") | `/topics` | Is topic content well built and saturated? | 8 | Topic tree slicer, KPI cards, flagged table |
| 8 | Knowledge & Confidence Matrix | `/matrix` | Which learner segments sit where on knowledge vs confidence? | 0 | Scatter/bubble quadrant chart |
| 9 | Content Delivery | `/delivery` | How much content is assigned to groups? | 6 | KPI cards, group table |
| 10 | Content Progression | `/progression` | Where are users across L1, L2, L3? | 3 | Matrix table, stacked bar |

Pages 1 to 8 are linked from the sidebar and (apart from the matrix tile layout) from homepage tiles. Pages 9 and 10 are listed in the sidebar but have no homepage tile.

---

## 2. Global elements (shared across pages)

- **Client slicer** (dropdown, single select). Present on every page. Sample value: "emirates". Drives all data. In the build this should be a global state (URL param or context) so the choice persists across routes.
- **Date range slicer** (two date pickers plus a slider). Present on every page. Default 1 Sep 2025 to 1 Oct 2026. Note: the Usage page showed a different default (1 Mar 2025 to 21 Oct 2026), which is likely an inconsistency in the source report. Recommend one shared date range in the build.
- **Page header**: a green icon tile at top left, page title in large bold text, a short subtitle of key themes (for example "Participation · frequency · active users · training users").
- **Visual style**: white page, pale green (#EEF5E6-ish) rounded cards with soft shadow, green accent colour (dark green for primary series, light green for secondary), blue for some line series, orange/purple/pink for learner-progress categories. KPI cards are a small grey label above a large value with a thin green vertical bar on the left.
- **Data source**: Axonify data in BigQuery (project `cosmic-kite-473215-j8`, dataset `axonify__bizgroup_emea`). Data refresh stamp ("Data updated 10/21/26") shows in the report footer, worth reproducing.
- **Terminology**: "Team" and "Training Group" are different dimensions (see pages 6 and 9). Learner progress levels: Beginner, Intermediate, Graduate, Expert, Not Started. Question difficulty levels: L1, L2, L3.

---

## 3. Page detail

### 3.1 Homepage (`/`)

Title: **Axonify Data Connect** with subtitle "Power BI Dashboard".

Top-right KPI strip (these five are the headline metrics for the whole client):

| KPI | Sample value |
|---|---|
| Engagement Health | 59% |
| Avg Frequency | 10.0x |
| Active Users | 3K |
| Avg Participation | 32% |
| Avg Knowledge | 85% |

Section "DASHBOARD PAGES": a card with 7 icon-and-label navigation tiles: Engagement (line chart icon), Knowledge (brain), Content (book), Usage (gears), Team Performance (speedometer with arrows), Topic Deep Dive (magnifier), Knowledge & Confidence Matrix (four-square matrix).

Visuals:
- **Avg Frequency by Month**: line chart, x = month (Sep 2025 to Oct 2026), y = avg frequency (range about 8 to 10.5). One blue line. Notable dip in Aug 2026.
- **Avg Participation by Month**: line chart, same x-axis, y = avg participation % (about 20% to 50%). One blue line. Peak in Feb 2026, sharp dip in Mar 2026.

### 3.2 Engagement (`/engagement`)

Title: **Engagement Overview**. Subtitle: Participation · frequency · active users · training users.

KPIs: Participation Rate 32%, Avg Time/Day 19.1 (minutes, presumably), Avg Frequency 10.0, Logged-in Users 894, Training Users 821.

Visuals:
- **Teams** hierarchical checkbox slicer (expandable parents such as Contact Center, Emirates Holidays, Retail; leaf teams like Admin, Bizgroup, Group CyberSecurity, L&T). Filters the chart and table.
- **Avg Participation and Avg Frequency by Month**: dual-axis line chart with markers. Dark green = participation (left axis, 20% to 50%), light green = frequency (right axis, 8 to 10). x = month.
- **Team table**: columns Team, Team Participation, Team Frequency Display (for example "0.4x"), Team Trend (for example "Stable", presumably with up/down variants). Long scrollable list of teams, sorted by Team Trend.

### 3.3 Knowledge (`/knowledge`)

Title: **Knowledge Growth**. Subtitle: Growth · Confidence · Topic Progress.

KPIs: Baseline Knowledge 71%, Current Knowledge 83%, Confidence Level 49%, Experts 439, Topic Completion 14%.

Visuals:
- **Knowledge growth by topic**: horizontal paired bar chart. Each topic has a dark green bar (Topic Current Knowledge) and a light green bar (Topic Baseline Knowledge), x axis 0% to 100%, scrollable list of topics.
- **Topic tree slicer** (checkbox, expandable): long topic names such as "ADVANCE SEAT RESERVATION/ PAID SEATING TOPIC 1: TYPES OF PAID...", "Confidence to travel - Reassure and guide the decision", "DID YOU KNOW: Arabian Adventures", "EKH Maldives Product & Destination Roadshow 2026".
- **Frequency table**: rows are frequency buckets ("< 10x / month", "10-20x / month", "20+ / month"); columns Frequency User %, Frequency Current Knowledge (data bar), Frequency Knowledge Lift (data bar). Sample: current knowledge 82%/84%/87%, lift 11%/15%/18%. Shows that more frequent learners have higher knowledge and lift.

### 3.4 Content & Programs (`/content`)

Title: **Content & Programs**. Subtitle: Topics · Types · Surveys · Content Health.

KPIs: Content Items 2K, Active Topics 288, Released Questions 2K, Last Updated 18/10/2026, Training Modules 24.

Visuals:
- **User Topic Progress Records**: single horizontal 100%-style stacked bar per client, segments Beginner (blue), Expert (dark blue), Graduate (orange), Intermediate (purple), Not Started (pink). Axis: Progress User-Topic Records, 0K to 300K.
- **Content Progression**: horizontal stacked bars by Difficulty Level (3, 2, 1) with legend Beginner, Expert, Graduate, Intermediate, Not Started (green for Not Started on this chart). Axis 0K to 120K. Note the colour mapping differs between the two charts in the source; recommend one consistent palette in the build.
- **Subjects**: radio-style list slicer (for example Arabian Adventures, EK Cybersecurity, Paid Lounge Access, Paid Seating, Promotional Upgrade, RCC BAGGAGE POLICY, Revenue ToolKit).

### 3.5 Usage & Activity (`/usage`)

Title: **Usage & Activity**. Subtitle: Hours · Games · Rewards · Platform.

KPIs: Training Hours 36K, Platform Logins 238K, Training Activities 238K, Games Played 50K, Points Spent 190, Broadcasts Sent 14.

Visuals:
- **Platform** checkbox slicer: Desktop, Mobile, Tablet.
- **Platform Access**: donut chart by platform. Desktop 11K (72.11%), Mobile 4K (27.74%), Tablet tiny.
- **Feature Usage % - Last 30 Days**: horizontal bar chart, features Daily training, Broadcasts, Games, Achievements, Rewards (Rewards near zero). Axis 0% to about 30%.
- **Training by Time of Day**: column chart, x = hour of day (0 to 23), y = training activity count (0 to 2,000). Spike around 3am, secondary bump around 17 to 18.

### 3.6 Team Performance (`/teams`)

Title: **Team Performance**. Subtitle: How are Individual Teams Performing?

No KPI cards. Visuals:
- **Team Name** checkbox slicer (scrollable: ABIDJAN, ABU DHABI, ABUJA, ACCRA, ADDIS ABABA, Admin...).
- **Team Performance Distribution**: single horizontal stacked bar of team counts by status. High 52 (green), Medium 48 (purple), Low 205 (blue), 305 teams total.
- **Top Performing Teams** table: Team Display Name, Team Participation, Team Frequency, Team Active Users, Team Status Label (coloured dot, "High"). Samples: BEG MGMT 100% / 26.80; BOM 79% / 13.55.
- **Teams Needing Attention** table: same columns, status "Low". Samples: ABU DHABI 0% / 0.07 / 84 users; ABUJA 0% / 0.00 / 28.
- **More Details** button with an arrow at bottom right. Its target was not opened in this review, so confirm where it navigates (likely a drill-through to a team detail view).

### 3.7 Topic Performance & Content Coverage (`/topics`)

Title: **Topic Performance & Content Coverage**. Subtitle: Learning Objectives & Question-Level Detail. This is the page behind the homepage "Topic Deep Dive" tile.

KPIs (two cards): Current Knowledge 86%, Knowledge Lift 14%, Audience 48K, Training Modules 24, Topic Completion 1%, Released Questions 2K, Target Groups 260, Latest Topic Created "16 Oct 2026".

Visuals:
- **Topic Selection**: large hierarchical checkbox slicer (parents "Emirates Holidays Contents" and "RCC - Compliance", expandable).
- **Topic detail table**: columns Topic, Target Groups, Modules, L1, L2, L3, Total Questions, Saturation (%), Content Flag, Priority. Conditional formatting: orange fill on L1/L2/L3 cells and on Content Flag when a rule triggers, for example "Information: Level exceeds 12 questions". Saturation values can exceed 100% (108%, 133%, 350%). Priority shown as a number (4 in samples).

### 3.8 Knowledge & Confidence Matrix (`/matrix`)

Title: **Knowledge & Confidence Matrix**. Subtitle: Data that Drives Performance.

Single large visual: **Knowledge & Confidence Matrix**, a scatter/bubble chart. x = Avg Knowledge Score (0 to 1), y = Avg Confidence Score (0 to 1), bubble size = learner count, shape/colour = Learner Segment: Experts (blue diamond), Graduated (dark blue square), Intermediate (orange circle, largest), Needs coaching (purple dot), Underconfident (pink dot). Dashed quadrant lines at x = 0.5 and y = 0.5. There is an empty outlined box top right that looks like a blank text or card placeholder (likely a leftover in the source report; omit or replace with a legend/summary).

### 3.9 Content Delivery (`/delivery`)

Title: **Content Delivery**. Subtitle: How much content is being assigned to people and groups?

KPIs (two cards): Avg Question Pool 2.09K, Estimated Months to Graduate 18.47, Avg Programs/Group "--", Max Program/Group "--", Avg Reinforcement Topics / Group "--", Max Reinforcement Topics / Group "--".

Visual: **Training group table**: Training Group Name, Group Status ("Active"), Programs Assigned, Reinforcement Topics Assigned. All sample rows showed 0 and four KPIs showed "--", so these measures look empty or broken in the current report. Worth confirming the intended logic before building (see open questions).

### 3.10 Content Progression (`/progression`)

Title: **Content Progression**. Subtitle: Where are users in their learning journey across L1, L2, and L3?

KPIs: Graduate / Expert % 14%, Not Started % 74%, User-Topic Records 298K.

Visuals:
- **Matrix table**: rows Question Level (3, 2, 1), columns Beginner, Expert, Graduate, Intermediate, Not Started (percentages; Beginner 0%, Expert/Graduate/Intermediate 1% each, Not Started 16%/14%/4%). Values look like percentages of total records and may be a measure issue (they do not sum to 100% per row).
- **Content Progression**: large horizontal stacked bar by difficulty level, same as on the Content page but bigger. Level 1 is the longest bar (about 112K records), levels 2 and 3 about 93K.

---

## 4. Suggested data model for the build

Entities implied by the report: Client, Team (hierarchical), Training Group, Topic (hierarchical, with Subject), Question (levels L1 to L3), User, UserTopicProgress (status: Beginner, Intermediate, Graduate, Expert, Not Started), Activity (timestamp, platform, feature), Date.

Measures to implement: Engagement Health, Avg Frequency (per active user per month), Active Users, Participation Rate, Avg Time/Day, Logged-in Users, Training Users, Baseline Knowledge, Current Knowledge, Knowledge Lift, Confidence Level, Experts count, Topic Completion, Team Status (High/Medium/Low thresholds), Saturation, Content Flag rules, Estimated Months to Graduate, Graduate/Expert %, Not Started %. The exact DAX definitions were not visible from the report view; pull them from the semantic model if the build needs to match numbers exactly.

## 5. Suggested Next.js structure

- `app/layout.tsx`: global header, client and date slicers (store in URL search params), sidebar or top nav for the 10 routes.
- `app/(dashboard)/<route>/page.tsx` for each page above.
- Shared components: `KpiCard`, `KpiStrip`, `PageHeader`, `TreeSlicer`, `ChecklistSlicer`, `DataTable` (with conditional formatting and data bars), `StackedBar`, `DualAxisLine`, `Donut`, `BubbleScatter`, `HourlyColumns`.
- Charting: Recharts or Tremor cover every chart type here. The scatter quadrant needs reference lines.
- Data: API routes or server actions querying BigQuery, or a pre-aggregated Supabase layer if live BigQuery is too slow.

## 6. Open questions and issues spotted in the source report

1. "More Details" button on Team Performance: destination not checked.
2. Content Delivery shows 0 programs and "--" KPIs, so the logic may be broken or the data not populated for this client.
3. Content Progression matrix percentages do not sum to 100% per row, so the denominator is probably wrong or the measure is mislabelled.
4. Usage page date range differs from every other page.
5. Progress-status colours are inconsistent between the Content page charts.
6. Homepage tile layout has no tile for Content Delivery or Content Progression; decide whether they become sub-pages of Content or top-level nav.
7. The matrix page has an empty bordered box top right.
8. Only the "emirates" client was reviewed. Other clients may expose different teams and topics.
