'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import {
  students,
  batches,
  courses,
  lectures,
  teachers,
  batchMaterials,
  deviceSessions,
  getUserDeviceSummaries,
  monthlyInsightsData,
} from '@/lib/mock-data';
import { Users, Layers, BookOpen, Monitor, FileText, Upload, ShieldAlert, GraduationCap } from 'lucide-react';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from '@/components/ui/chart';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  AreaChart,
  Area,
} from 'recharts';

// ─── KPI Data ───────────────────────────────────────────────────────
const activeBatches = batches.filter((b) => b.status === 'active').length;
const activeSessionsCount = deviceSessions.filter((d) => d.isActive).length;
const totalLectures = lectures.length;
const totalMaterials = batchMaterials.length;
const summaries = getUserDeviceSummaries();
const usersAtLimit = summaries.filter((s) => s.activeSessions.length >= 2).length;
const totalTeachers = teachers.length;

// ─── Section A: Student & Enrollment ────────────────────────────────
const activeStudents = students.filter((s) => s.status === 'active').length;
const inactiveStudents = students.filter((s) => s.status === 'inactive').length;

const studentStatusData = [
  { name: 'Active', value: activeStudents, fill: '#C5D86D' },
  { name: 'Inactive', value: inactiveStudents, fill: '#D1D5DB' },
];
const studentStatusConfig: ChartConfig = {
  Active: { label: 'Active', color: '#C5D86D' },
  Inactive: { label: 'Inactive', color: '#D1D5DB' },
};

const enrollmentPerBatchData = batches.map((b) => ({
  name: b.name.replace(/Batch \d+ - /, ''),
  students: b.studentCount,
}));
const enrollmentPerBatchConfig: ChartConfig = {
  students: { label: 'Students', color: '#1A1A1A' },
};

const enrollmentGrowthData = monthlyInsightsData.reduce<{ month: string; cumulative: number }[]>(
  (acc, item) => {
    const prev = acc.length > 0 ? acc[acc.length - 1].cumulative : 0;
    acc.push({ month: item.month.replace(' 2024', ''), cumulative: prev + item.newEnrollments });
    return acc;
  },
  []
);
const enrollmentGrowthConfig: ChartConfig = {
  cumulative: { label: 'Total Enrollments', color: '#C5D86D' },
};

// ─── Section B: Batch Performance ───────────────────────────────────
const completedBatches = batches.filter((b) => b.status === 'completed').length;
const activeBatchCount = batches.filter((b) => b.status === 'active').length;
const upcomingBatches = batches.filter((b) => b.status === 'upcoming').length;

const batchStatusData = [
  { name: 'Completed', value: completedBatches, fill: '#9CA3AF' },
  { name: 'Active', value: activeBatchCount, fill: '#C5D86D' },
  { name: 'Upcoming', value: upcomingBatches, fill: '#FCD34D' },
];
const batchStatusConfig: ChartConfig = {
  Completed: { label: 'Completed', color: '#9CA3AF' },
  Active: { label: 'Active', color: '#C5D86D' },
  Upcoming: { label: 'Upcoming', color: '#FCD34D' },
};

const studentsPerBatchData = batches.map((b) => ({
  name: b.name.replace(/Batch \d+ - /, ''),
  students: b.studentCount,
}));
const studentsPerBatchConfig: ChartConfig = {
  students: { label: 'Students', color: '#C5D86D' },
};

const teacherWorkloadData = teachers.map((t) => {
  const batchCount = t.batchIds.length;
  const studentCount = t.batchIds.reduce((sum, bid) => {
    const batch = batches.find((b) => b.id === bid);
    return sum + (batch?.studentCount ?? 0);
  }, 0);
  return { name: t.name.split(' ')[0], batches: batchCount, students: studentCount };
});
const teacherWorkloadConfig: ChartConfig = {
  batches: { label: 'Batches', color: '#1A1A1A' },
  students: { label: 'Students', color: '#C5D86D' },
};

// ─── Section C: Course & Content ────────────────────────────────────
const activeCourses = courses.filter((c) => c.status === 'active').length;
const upcomingCourses = courses.filter((c) => c.status === 'upcoming').length;

const courseStatusData = [
  { name: 'Active', value: activeCourses, fill: '#C5D86D' },
  { name: 'Upcoming', value: upcomingCourses, fill: '#FCD34D' },
];
const courseStatusConfig: ChartConfig = {
  Active: { label: 'Active', color: '#C5D86D' },
  Upcoming: { label: 'Upcoming', color: '#FCD34D' },
};

const lecturesPerCourseData = courses.map((c) => ({
  name: c.title.length > 18 ? c.title.slice(0, 18) + '…' : c.title,
  lectures: lectures.filter((l) => l.courseId === c.id).length,
}));
const lecturesPerCourseConfig: ChartConfig = {
  lectures: { label: 'Lectures', color: '#1A1A1A' },
};

const materialTypeCounts: Record<string, number> = {};
batchMaterials.forEach((m) => {
  materialTypeCounts[m.fileType] = (materialTypeCounts[m.fileType] || 0) + 1;
});
const materialColors: Record<string, string> = {
  pdf: '#EF4444',
  excel: '#22C55E',
  word: '#3B82F6',
  pptx: '#F97316',
};
const materialsByTypeData = Object.entries(materialTypeCounts).map(([type, value]) => ({
  name: type.toUpperCase(),
  value,
  fill: materialColors[type] || '#9CA3AF',
}));
const materialsByTypeConfig: ChartConfig = Object.fromEntries(
  Object.entries(materialTypeCounts).map(([type]) => [
    type.toUpperCase(),
    { label: type.toUpperCase(), color: materialColors[type] || '#9CA3AF' },
  ])
);

// ─── Section D: Device & Security ───────────────────────────────────
const usersWithActive = summaries.filter((s) => s.activeSessions.length > 0 && s.activeSessions.length < 2).length;
const usersAtLimitCount = summaries.filter((s) => s.activeSessions.length >= 2).length;
const usersNoDevice = summaries.filter((s) => s.activeSessions.length === 0).length;

const deviceOverviewData = [
  { name: 'Active', value: usersWithActive, fill: '#C5D86D' },
  { name: 'At Limit', value: usersAtLimitCount, fill: '#EF4444' },
  { name: 'No Sessions', value: usersNoDevice, fill: '#D1D5DB' },
];
const deviceOverviewConfig: ChartConfig = {
  Active: { label: 'Active', color: '#C5D86D' },
  'At Limit': { label: 'At Limit', color: '#EF4444' },
  'No Sessions': { label: 'No Sessions', color: '#D1D5DB' },
};

const monthlySessionsData = monthlyInsightsData.map((d) => ({
  month: d.month.replace(' 2024', ''),
  sessions: d.activeSessions,
  issues: d.deviceIssues,
}));
const monthlySessionsConfig: ChartConfig = {
  sessions: { label: 'Sessions', color: '#C5D86D' },
  issues: { label: 'Issues', color: '#EF4444' },
};

// ─── KPI Cards Config ───────────────────────────────────────────────
const primaryKPIs = [
  { label: 'Total Students', value: students.length, icon: <Users size={22} />, accent: '#C5D86D' },
  { label: 'Active Batches', value: activeBatches, icon: <Layers size={22} />, accent: '#E8E8E8' },
  { label: 'Total Courses', value: courses.length, icon: <BookOpen size={22} />, accent: '#C5D86D' },
  { label: 'Active Sessions', value: activeSessionsCount, icon: <Monitor size={22} />, accent: '#E8E8E8' },
];

const secondaryKPIs = [
  { label: 'Total Lectures', value: totalLectures, icon: <FileText size={16} /> },
  { label: 'Materials Uploaded', value: totalMaterials, icon: <Upload size={16} /> },
  { label: 'Users at Device Limit', value: usersAtLimit, icon: <ShieldAlert size={16} /> },
  { label: 'Total Teachers', value: totalTeachers, icon: <GraduationCap size={16} /> },
];

// ─── Component ──────────────────────────────────────────────────────
export default function InsightsPage() {
  return (
    <DashboardLayout role="admin" userName="Admin User">
      <DashboardHeader greeting="Insights" subtitle="Visual overview of your institute's performance" />

      {/* Row 1: Primary KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-4">
        {primaryKPIs.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center mb-4"
              style={{ backgroundColor: kpi.accent }}
            >
              {kpi.icon}
            </div>
            <p className="text-2xl sm:text-3xl font-bold text-[#1A1A1A]">{kpi.value}</p>
            <p className="text-sm text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Row 2: Secondary KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {secondaryKPIs.map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-4 card-shadow flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gray-100 flex items-center justify-center text-gray-600">
              {kpi.icon}
            </div>
            <div>
              <p className="text-lg font-bold text-[#1A1A1A]">{kpi.value}</p>
              <p className="text-xs text-gray-500">{kpi.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Section A: Student & Enrollment */}
      <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Student &amp; Enrollment</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Student Status Donut */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Student Status</h3>
          <ChartContainer config={studentStatusConfig} className="h-[250px] aspect-auto w-full">
            <PieChart>
              <Pie
                data={studentStatusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
              >
                {studentStatusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </div>

        {/* Enrollment per Batch Bar */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Enrollment per Batch</h3>
          <ChartContainer config={enrollmentPerBatchConfig} className="h-[250px] aspect-auto w-full">
            <BarChart data={enrollmentPerBatchData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, angle: -35, textAnchor: 'end' } as Record<string, unknown>} height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="students" fill="#1A1A1A" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Enrollment Growth Area — full width */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden lg:col-span-2">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Enrollment Growth</h3>
          <ChartContainer config={enrollmentGrowthConfig} className="h-[250px] aspect-auto w-full">
            <AreaChart data={enrollmentGrowthData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Area
                type="monotone"
                dataKey="cumulative"
                stroke="#C5D86D"
                fill="#C5D86D"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>

      {/* Section B: Batch Performance */}
      <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Batch Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Batch Status Donut */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Batch Status</h3>
          <ChartContainer config={batchStatusConfig} className="h-[250px] aspect-auto w-full">
            <PieChart>
              <Pie
                data={batchStatusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
              >
                {batchStatusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </div>

        {/* Students per Batch Bar */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Students per Batch</h3>
          <ChartContainer config={studentsPerBatchConfig} className="h-[250px] aspect-auto w-full">
            <BarChart data={studentsPerBatchData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, angle: -35, textAnchor: 'end' } as Record<string, unknown>} height={50} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="students" fill="#C5D86D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Teacher Workload Grouped Bar */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Teacher Workload</h3>
          <ChartContainer config={teacherWorkloadConfig} className="h-[250px] aspect-auto w-full">
            <BarChart data={teacherWorkloadData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="batches" fill="#1A1A1A" radius={[6, 6, 0, 0]} />
              <Bar dataKey="students" fill="#C5D86D" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </div>
      </div>

      {/* Section C: Course & Content */}
      <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Course &amp; Content</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {/* Course Status Donut */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Course Status</h3>
          <ChartContainer config={courseStatusConfig} className="h-[250px] aspect-auto w-full">
            <PieChart>
              <Pie
                data={courseStatusData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
              >
                {courseStatusData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </div>

        {/* Lectures per Course Horizontal Bar */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Lectures per Course</h3>
          <ChartContainer config={lecturesPerCourseConfig} className="h-[250px] aspect-auto w-full">
            <BarChart data={lecturesPerCourseData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} />
              <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="lectures" fill="#1A1A1A" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ChartContainer>
        </div>

        {/* Materials by Type Pie */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Materials by Type</h3>
          <ChartContainer config={materialsByTypeConfig} className="h-[250px] aspect-auto w-full">
            <PieChart>
              <Pie
                data={materialsByTypeData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
              >
                {materialsByTypeData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </div>
      </div>

      {/* Section D: Device & Security */}
      <h2 className="text-lg font-semibold text-[#1A1A1A] mb-4">Device &amp; Security</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {/* Device Sessions Overview Donut */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Device Sessions Overview</h3>
          <ChartContainer config={deviceOverviewConfig} className="h-[250px] aspect-auto w-full">
            <PieChart>
              <Pie
                data={deviceOverviewData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                innerRadius={50}
                outerRadius={80}
              >
                {deviceOverviewData.map((entry) => (
                  <Cell key={entry.name} fill={entry.fill} />
                ))}
              </Pie>
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent nameKey="name" />} />
            </PieChart>
          </ChartContainer>
        </div>

        {/* Monthly Sessions & Issues Dual Area */}
        <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
          <h3 className="text-sm font-semibold text-[#1A1A1A] mb-4">Monthly Sessions &amp; Issues</h3>
          <ChartContainer config={monthlySessionsConfig} className="h-[250px] aspect-auto w-full">
            <AreaChart data={monthlySessionsData}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} interval={1} />
              <YAxis tick={{ fontSize: 11 }} />
              <ChartTooltip content={<ChartTooltipContent />} />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="sessions"
                stroke="#C5D86D"
                fill="#C5D86D"
                fillOpacity={0.2}
              />
              <Area
                type="monotone"
                dataKey="issues"
                stroke="#EF4444"
                fill="#EF4444"
                fillOpacity={0.2}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </div>
    </DashboardLayout>
  );
}
