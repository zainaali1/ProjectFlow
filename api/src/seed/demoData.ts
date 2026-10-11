/**
 * Demo data for ProjectFlow.
 *
 * The names, descriptions and task breakdowns below were written by an AI
 * assistant (Claude) from the prompt in docs/AI_DEMO_DATA.md. Dates are stored
 * as day offsets from "today" so the demo always looks current, whenever you
 * seed it. `buildDemoData()` turns this into concrete rows, including a
 * generated, clash-free schedule.
 */

export interface DemoWorker {
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  hourlyRate: number;
}

export interface DemoProject {
  key: string;
  name: string;
  description: string;
  status: 'Planned' | 'Active' | 'OnHold' | 'Completed';
  startOffset: number;
  endOffset: number;
  budget: number;
  color: string;
}

export interface DemoTask {
  project: string;
  title: string;
  description: string;
  status: 'Todo' | 'InProgress' | 'Blocked' | 'Done';
  priority: 'Low' | 'Medium' | 'High' | 'Critical';
  estimatedHours: number;
  dueOffset: number;
  /** emails of workers who get schedule blocks for this task */
  assignees: string[];
}

export const demoWorkers: DemoWorker[] = [
  { firstName: 'Amara', lastName: 'Okafor', email: 'amara.okafor@contoso.dev', role: 'Project Manager', hourlyRate: 95 },
  { firstName: 'Diego', lastName: 'Ramírez', email: 'diego.ramirez@contoso.dev', role: 'Full-Stack Developer', hourlyRate: 85 },
  { firstName: 'Priya', lastName: 'Natarajan', email: 'priya.natarajan@contoso.dev', role: 'Backend Developer', hourlyRate: 82 },
  { firstName: 'Liam', lastName: "O'Connor", email: 'liam.oconnor@contoso.dev', role: 'Frontend Developer', hourlyRate: 78 },
  { firstName: 'Mei', lastName: 'Chen', email: 'mei.chen@contoso.dev', role: 'UX Designer', hourlyRate: 74 },
  { firstName: 'Kwame', lastName: 'Mensah', email: 'kwame.mensah@contoso.dev', role: 'DevOps Engineer', hourlyRate: 88 },
  { firstName: 'Sofia', lastName: 'Rossi', email: 'sofia.rossi@contoso.dev', role: 'QA Engineer', hourlyRate: 65 },
  { firstName: 'Noah', lastName: 'Fischer', email: 'noah.fischer@contoso.dev', role: 'Data Engineer', hourlyRate: 86 },
  { firstName: 'Fatima', lastName: 'Haddad', email: 'fatima.haddad@contoso.dev', role: 'Business Analyst', hourlyRate: 70 },
  { firstName: 'Ethan', lastName: 'Brooks', email: 'ethan.brooks@contoso.dev', role: 'Mobile Developer', hourlyRate: 80 },
  { firstName: 'Yuki', lastName: 'Tanaka', email: 'yuki.tanaka@contoso.dev', role: 'Security Engineer', hourlyRate: 92 },
  { firstName: 'Grace', lastName: 'Adeyemi', email: 'grace.adeyemi@contoso.dev', role: 'Technical Writer', hourlyRate: 58 },
];

export const demoProjects: DemoProject[] = [
  {
    key: 'portal',
    name: 'Customer Self-Service Portal',
    description: 'A web portal where customers can view orders, download invoices and raise support tickets without calling the help desk.',
    status: 'Active', startOffset: -45, endOffset: 60, budget: 185000, color: '#4F46E5',
  },
  {
    key: 'mobile',
    name: 'Field Technician Mobile App',
    description: 'Offline-first mobile app that gives field technicians their daily job list, parts inventory and photo-based sign-off.',
    status: 'Active', startOffset: -20, endOffset: 90, budget: 240000, color: '#0891B2',
  },
  {
    key: 'warehouse',
    name: 'Data Warehouse Modernization',
    description: 'Move nightly reporting from on-prem SSIS jobs to Azure Data Factory and a dimensional model in Azure SQL.',
    status: 'Active', startOffset: -70, endOffset: 30, budget: 130000, color: '#059669',
  },
  {
    key: 'security',
    name: 'Zero Trust Security Rollout',
    description: 'Enforce Entra ID conditional access, MFA and least-privilege roles across all internal line-of-business apps.',
    status: 'OnHold', startOffset: -10, endOffset: 120, budget: 95000, color: '#DC2626',
  },
  {
    key: 'website',
    name: 'Marketing Website Redesign',
    description: 'Refresh brand, rebuild the public website for speed and accessibility (WCAG 2.2 AA), and move content to a headless CMS.',
    status: 'Completed', startOffset: -120, endOffset: -15, budget: 72000, color: '#D97706',
  },
  {
    key: 'ai',
    name: 'AI Support Assistant Pilot',
    description: 'Pilot an AI assistant that drafts answers to support tickets from the knowledge base, with human review before sending.',
    status: 'Planned', startOffset: 25, endOffset: 110, budget: 60000, color: '#9333EA',
  },
];

const W = {
  amara: 'amara.okafor@contoso.dev', diego: 'diego.ramirez@contoso.dev', priya: 'priya.natarajan@contoso.dev',
  liam: 'liam.oconnor@contoso.dev', mei: 'mei.chen@contoso.dev', kwame: 'kwame.mensah@contoso.dev',
  sofia: 'sofia.rossi@contoso.dev', noah: 'noah.fischer@contoso.dev', fatima: 'fatima.haddad@contoso.dev',
  ethan: 'ethan.brooks@contoso.dev', yuki: 'yuki.tanaka@contoso.dev', grace: 'grace.adeyemi@contoso.dev',
};

export const demoTasks: DemoTask[] = [
  // Customer Self-Service Portal
  { project: 'portal', title: 'Gather portal requirements', description: 'Interview support leads and 5 key customers; produce prioritized user stories.', status: 'Done', priority: 'High', estimatedHours: 24, dueOffset: -35, assignees: [W.fatima, W.amara] },
  { project: 'portal', title: 'Design portal wireframes', description: 'Low-fidelity wireframes for dashboard, orders, invoices and tickets; mobile first.', status: 'Done', priority: 'High', estimatedHours: 32, dueOffset: -25, assignees: [W.mei] },
  { project: 'portal', title: 'Set up Entra ID sign-in', description: 'Customer sign-in with Entra External ID, token validation in the API.', status: 'Done', priority: 'Critical', estimatedHours: 20, dueOffset: -12, assignees: [W.yuki, W.diego] },
  { project: 'portal', title: 'Build orders API', description: 'REST endpoints for order list and order detail with paging and filtering.', status: 'InProgress', priority: 'High', estimatedHours: 40, dueOffset: 5, assignees: [W.priya] },
  { project: 'portal', title: 'Invoice PDF download', description: 'Generate and stream invoice PDFs from the billing system; cache in Blob Storage.', status: 'InProgress', priority: 'Medium', estimatedHours: 28, dueOffset: 12, assignees: [W.priya, W.diego] },
  { project: 'portal', title: 'Support ticket form', description: 'Form with attachments that creates tickets in the help desk system.', status: 'Todo', priority: 'Medium', estimatedHours: 24, dueOffset: 20, assignees: [W.liam] },
  { project: 'portal', title: 'Responsive dashboard UI', description: 'Implement dashboard cards and order table that adapt from phone to desktop.', status: 'InProgress', priority: 'High', estimatedHours: 36, dueOffset: 8, assignees: [W.liam, W.mei] },
  { project: 'portal', title: 'Portal end-to-end tests', description: 'Playwright tests for sign-in, orders and invoices across three browsers.', status: 'Todo', priority: 'Medium', estimatedHours: 30, dueOffset: 35, assignees: [W.sofia] },
  { project: 'portal', title: 'Customer help articles', description: 'Write 10 short how-to articles linked from the portal.', status: 'Todo', priority: 'Low', estimatedHours: 16, dueOffset: 50, assignees: [W.grace] },

  // Field Technician Mobile App
  { project: 'mobile', title: 'Technician journey mapping', description: 'Ride along with two technicians and map their day, pain points and offline gaps.', status: 'Done', priority: 'High', estimatedHours: 16, dueOffset: -12, assignees: [W.fatima, W.mei] },
  { project: 'mobile', title: 'Offline sync design', description: 'Choose sync strategy and conflict rules for jobs, parts and photos.', status: 'InProgress', priority: 'Critical', estimatedHours: 24, dueOffset: 4, assignees: [W.ethan, W.priya] },
  { project: 'mobile', title: 'Job list screen', description: 'Daily job list with map view, status chips and pull-to-refresh.', status: 'InProgress', priority: 'High', estimatedHours: 32, dueOffset: 14, assignees: [W.ethan] },
  { project: 'mobile', title: 'Photo sign-off capture', description: 'Capture photos and customer signature; upload when connectivity returns.', status: 'Todo', priority: 'High', estimatedHours: 30, dueOffset: 28, assignees: [W.ethan, W.liam] },
  { project: 'mobile', title: 'Parts inventory API', description: 'Expose van stock levels and reservations from the ERP.', status: 'Blocked', priority: 'Medium', estimatedHours: 26, dueOffset: 18, assignees: [W.noah] },
  { project: 'mobile', title: 'Mobile CI pipeline', description: 'Build, sign and distribute test builds from GitHub Actions.', status: 'Todo', priority: 'Medium', estimatedHours: 18, dueOffset: 22, assignees: [W.kwame] },
  { project: 'mobile', title: 'Pilot with 10 technicians', description: 'Run a two-week pilot and collect feedback.', status: 'Todo', priority: 'High', estimatedHours: 40, dueOffset: 70, assignees: [W.amara, W.sofia] },

  // Data Warehouse Modernization
  { project: 'warehouse', title: 'Inventory existing SSIS jobs', description: 'List all packages, schedules, sources and downstream reports.', status: 'Done', priority: 'High', estimatedHours: 20, dueOffset: -60, assignees: [W.noah, W.fatima] },
  { project: 'warehouse', title: 'Design star schema', description: 'Sales, inventory and service fact tables with conformed dimensions.', status: 'Done', priority: 'Critical', estimatedHours: 36, dueOffset: -40, assignees: [W.noah] },
  { project: 'warehouse', title: 'Build ADF pipelines', description: 'Incremental loads with watermarking and retry policies.', status: 'InProgress', priority: 'High', estimatedHours: 60, dueOffset: 3, assignees: [W.noah, W.kwame] },
  { project: 'warehouse', title: 'Reconcile report totals', description: 'Compare old and new reports for 3 months of history; explain differences.', status: 'InProgress', priority: 'High', estimatedHours: 24, dueOffset: 10, assignees: [W.sofia, W.fatima] },
  { project: 'warehouse', title: 'Decommission on-prem jobs', description: 'Turn off SSIS schedules after sign-off; archive packages.', status: 'Todo', priority: 'Medium', estimatedHours: 8, dueOffset: 28, assignees: [W.kwame] },
  { project: 'warehouse', title: 'Data dictionary', description: 'Document every table and measure for report authors.', status: 'Todo', priority: 'Low', estimatedHours: 14, dueOffset: 25, assignees: [W.grace] },

  // Zero Trust Security Rollout
  { project: 'security', title: 'App access audit', description: 'Review who can access each internal app and why.', status: 'Done', priority: 'High', estimatedHours: 18, dueOffset: -4, assignees: [W.yuki] },
  { project: 'security', title: 'Conditional access policies', description: 'Draft policies for MFA, device compliance and risky sign-ins.', status: 'Blocked', priority: 'Critical', estimatedHours: 22, dueOffset: 15, assignees: [W.yuki, W.kwame] },
  { project: 'security', title: 'Role-based access model', description: 'Define app roles and groups for each line-of-business app.', status: 'Todo', priority: 'High', estimatedHours: 16, dueOffset: 30, assignees: [W.yuki, W.fatima] },
  { project: 'security', title: 'Staff MFA guide', description: 'Plain-language guide and FAQ for staff enrolling in MFA.', status: 'Todo', priority: 'Medium', estimatedHours: 10, dueOffset: 40, assignees: [W.grace] },

  // Marketing Website Redesign (completed)
  { project: 'website', title: 'Brand refresh', description: 'New palette, typography and component library.', status: 'Done', priority: 'High', estimatedHours: 40, dueOffset: -95, assignees: [W.mei] },
  { project: 'website', title: 'Headless CMS migration', description: 'Move 180 pages to the headless CMS with redirects.', status: 'Done', priority: 'High', estimatedHours: 50, dueOffset: -60, assignees: [W.diego, W.grace] },
  { project: 'website', title: 'Accessibility audit', description: 'WCAG 2.2 AA audit and fixes for all templates.', status: 'Done', priority: 'Critical', estimatedHours: 24, dueOffset: -35, assignees: [W.sofia, W.liam] },
  { project: 'website', title: 'Go-live and monitoring', description: 'DNS cut-over, CDN rules, uptime and Core Web Vitals monitoring.', status: 'Done', priority: 'High', estimatedHours: 12, dueOffset: -16, assignees: [W.kwame, W.diego] },

  // AI Support Assistant Pilot (planned)
  { project: 'ai', title: 'Define pilot success metrics', description: 'Agree on accuracy, handling-time and satisfaction targets.', status: 'Todo', priority: 'High', estimatedHours: 8, dueOffset: 30, assignees: [W.amara, W.fatima] },
  { project: 'ai', title: 'Knowledge base clean-up', description: 'Remove outdated articles and tag the rest by product.', status: 'Todo', priority: 'Medium', estimatedHours: 20, dueOffset: 45, assignees: [W.grace] },
  { project: 'ai', title: 'Prototype answer drafting', description: 'Prototype retrieval + drafting against 200 historical tickets.', status: 'Todo', priority: 'High', estimatedHours: 40, dueOffset: 65, assignees: [W.priya, W.noah] },
  { project: 'ai', title: 'Responsible AI review', description: 'Privacy, safety and human-in-the-loop review before pilot.', status: 'Todo', priority: 'Critical', estimatedHours: 12, dueOffset: 80, assignees: [W.yuki, W.amara] },
];
