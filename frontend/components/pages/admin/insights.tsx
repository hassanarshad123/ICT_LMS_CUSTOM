'use client';

import DashboardLayout from '@/components/layout/dashboard-layout';
import DashboardHeader from '@/components/layout/dashboard-header';
import { useAuth } from '@/lib/auth-context';
import { useBasePath } from '@/hooks/use-base-path';
import { useApi } from '@/hooks/use-api';
import { getInsights } from '@/lib/api/admin';
import { PageLoading, PageError } from '@/components/shared/page-states';
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
} from 'recharts';

export default function InsightsPage() {
  const { name } = useAuth();
  const basePath = useBasePath();
  const { data, loading, error, refetch } = useApi(getInsights);

  if (loading) {
    return (
      <DashboardLayout>
        <DashboardHeader greeting="Insights" subtitle="Visual overview of your institute's performance" />
        <PageLoading variant="cards" />
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout>
        <DashboardHeader greeting="Insights" subtitle="Visual overview of your institute's performance" />
        <PageError message={error} onRetry={refetch} />
      </DashboardLayout>
    );
  }

  if (!data) return null;

  // Transform API data for charts
  const studentsByStatus = data.studentsByStatus || {};
  const batchesByStatus = data.batchesByStatus || {};
  const enrollmentPerBatch = data.enrollmentPerBatch || [];
  const teacherWorkload = data.teacherWorkload || [];
  const materialsByType = data.materialsByType || {};
  const lecturesPerCourse = data.lecturesPerCourse || [];
  const deviceOverview = data.deviceOverview || {};

  // Student Status
  const studentStatusData = Object.entries(studentsByStatus).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    fill: name === 'active' ? 'hsl(var(--accent))' : '#D1D5DB',
  }));
  const studentStatusConfig: ChartConfig = Object.fromEntries(
    studentStatusData.map((d) => [d.name, { label: d.name, color: d.fill }])
  );

  // Batch Status
  const batchStatusColors: Record<string, string> = { completed: '#9CA3AF', active: 'hsl(var(--accent))', upcoming: '#FCD34D' };
  const batchStatusData = Object.entries(batchesByStatus).map(([name, value]) => ({
    name: name.charAt(0).toUpperCase() + name.slice(1),
    value,
    fill: batchStatusColors[name] || '#9CA3AF',
  }));
  const batchStatusConfig: ChartConfig = Object.fromEntries(
    batchStatusData.map((d) => [d.name, { label: d.name, color: d.fill }])
  );

  // Enrollment per batch
  const enrollmentData = enrollmentPerBatch.map((b: any) => ({
    name: (b.name || b.batchName || '').replace(/Batch \d+ - /, ''),
    students: b.studentCount || b.students || 0,
  }));
  const enrollmentConfig: ChartConfig = { students: { label: 'Students', color: 'hsl(var(--primary))' } };

  // Teacher workload
  const workloadData = teacherWorkload.map((t: any) => ({
    name: (t.name || t.teacherName || '').split(' ')[0],
    batches: t.batchCount || t.batches || 0,
    students: t.studentCount || t.students || 0,
  }));
  const workloadConfig: ChartConfig = { batches: { label: 'Batches', color: 'hsl(var(--primary))' }, students: { label: 'Students', color: 'hsl(var(--accent))' } };

  // Lectures per course
  const lecturesData = lecturesPerCourse.map((c: any) => {
    const label = c.title || c.name || c.courseTitle || '';
    return {
      name: label.length > 18 ? label.slice(0, 18) + '...' : label,
      lectures: c.lectureCount || c.lectures || 0,
    };
  });
  const lecturesConfig: ChartConfig = { lectures: { label: 'Lectures', color: 'hsl(var(--primary))' } };

  // Materials by type
  const materialColors: Record<string, string> = { pdf: '#EF4444', excel: '#22C55E', word: '#3B82F6', pptx: '#F97316' };
  const materialsData = Object.entries(materialsByType).map(([type, value]) => ({
    name: type.toUpperCase(),
    value,
    fill: materialColors[type] || '#9CA3AF',
  }));
  const materialsConfig: ChartConfig = Object.fromEntries(
    materialsData.map((d) => [d.name, { label: d.name, color: d.fill }])
  );

  // Device overview
  const deviceColors: Record<string, string> = { active: 'hsl(var(--accent))', atLimit: '#EF4444', noSessions: '#D1D5DB' };
  const deviceData = Object.entries(deviceOverview).map(([key, value]) => ({
    name: key.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()),
    value,
    fill: deviceColors[key] || '#9CA3AF',
  }));
  const deviceConfig: ChartConfig = Object.fromEntries(
    deviceData.map((d) => [d.name, { label: d.name, color: d.fill }])
  );

  // Sum totals for KPIs
  const totalStudents = Object.values(studentsByStatus).reduce((a: number, b: any) => a + (b as number), 0);
  const activeBatches = (batchesByStatus as any).active || 0;
  const totalCourses = lecturesPerCourse.length;

  return (
    <DashboardLayout>
      <DashboardHeader greeting="Insights" subtitle="Visual overview of your institute's performance" />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
        {[
          { label: 'Total Students', value: totalStudents, icon: <Users size={22} />, accent: 'hsl(var(--accent))' },
          { label: 'Active Batches', value: activeBatches, icon: <Layers size={22} />, accent: 'hsl(var(--secondary))' },
          { label: 'Total Courses', value: totalCourses, icon: <BookOpen size={22} />, accent: 'hsl(var(--accent))' },
          { label: 'Total Teachers', value: teacherWorkload.length, icon: <GraduationCap size={22} />, accent: 'hsl(var(--secondary))' },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center mb-4" style={{ backgroundColor: kpi.accent }}>{kpi.icon}</div>
            <p className="text-2xl sm:text-3xl font-bold text-primary">{kpi.value}</p>
            <p className="text-sm text-gray-500 mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Student & Enrollment */}
      <h2 className="text-lg font-semibold text-primary mb-4">Student &amp; Enrollment</h2>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
        {studentStatusData.length > 0 && (
          <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
            <h3 className="text-sm font-semibold text-primary mb-4">Student Status</h3>
            <ChartContainer config={studentStatusConfig} className="h-[180px] sm:h-[250px] aspect-auto w-full">
              <PieChart>
                <Pie data={studentStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {studentStatusData.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </div>
        )}
        {enrollmentData.length > 0 && (
          <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
            <h3 className="text-sm font-semibold text-primary mb-4">Enrollment per Batch</h3>
            <ChartContainer config={enrollmentConfig} className="h-[180px] sm:h-[250px] aspect-auto w-full">
              <BarChart data={enrollmentData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, angle: -35, textAnchor: 'end' } as Record<string, unknown>} height={50} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="students" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </div>

      {/* Batch Performance */}
      <h2 className="text-lg font-semibold text-primary mb-4">Batch Performance</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {batchStatusData.length > 0 && (
          <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
            <h3 className="text-sm font-semibold text-primary mb-4">Batch Status</h3>
            <ChartContainer config={batchStatusConfig} className="h-[180px] sm:h-[250px] aspect-auto w-full">
              <PieChart>
                <Pie data={batchStatusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                  {batchStatusData.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent nameKey="name" />} />
              </PieChart>
            </ChartContainer>
          </div>
        )}
        {workloadData.length > 0 && (
          <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden lg:col-span-2">
            <h3 className="text-sm font-semibold text-primary mb-4">Teacher Workload</h3>
            <ChartContainer config={workloadConfig} className="h-[180px] sm:h-[250px] aspect-auto w-full">
              <BarChart data={workloadData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <ChartLegend content={<ChartLegendContent />} />
                <Bar dataKey="batches" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                <Bar dataKey="students" fill="hsl(var(--accent))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </div>
        )}
      </div>

      {/* Course & Content */}
      {(lecturesData.length > 0 || materialsData.length > 0) && (
        <>
          <h2 className="text-lg font-semibold text-primary mb-4">Course &amp; Content</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
            {lecturesData.length > 0 && (
              <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
                <h3 className="text-sm font-semibold text-primary mb-4">Lectures per Course</h3>
                <ChartContainer config={lecturesConfig} className="h-[180px] sm:h-[250px] aspect-auto w-full">
                  <BarChart data={lecturesData} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={100} />
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <Bar dataKey="lectures" fill="hsl(var(--primary))" radius={[0, 6, 6, 0]} />
                  </BarChart>
                </ChartContainer>
              </div>
            )}
            {materialsData.length > 0 && (
              <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
                <h3 className="text-sm font-semibold text-primary mb-4">Materials by Type</h3>
                <ChartContainer config={materialsConfig} className="h-[180px] sm:h-[250px] aspect-auto w-full">
                  <PieChart>
                    <Pie data={materialsData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                      {materialsData.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}
                    </Pie>
                    <ChartTooltip content={<ChartTooltipContent />} />
                    <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                  </PieChart>
                </ChartContainer>
              </div>
            )}
          </div>
        </>
      )}

      {/* Device & Security */}
      {deviceData.length > 0 && (
        <>
          <h2 className="text-lg font-semibold text-primary mb-4">Device &amp; Security</h2>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-8">
            <div className="bg-white rounded-2xl p-6 card-shadow overflow-hidden">
              <h3 className="text-sm font-semibold text-primary mb-4">Device Sessions Overview</h3>
              <ChartContainer config={deviceConfig} className="h-[180px] sm:h-[250px] aspect-auto w-full">
                <PieChart>
                  <Pie data={deviceData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                    {deviceData.map((entry) => (<Cell key={entry.name} fill={entry.fill} />))}
                  </Pie>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <ChartLegend content={<ChartLegendContent nameKey="name" />} />
                </PieChart>
              </ChartContainer>
            </div>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
