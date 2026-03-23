const INSTITUTES = [
  {
    name: "TechPro Academy",
    slug: "techpro",
    status: "active",
    students: 342,
    storage: 68,
    plan: "Pro",
  },
  {
    name: "Design Institute",
    slug: "designinst",
    status: "active",
    students: 156,
    storage: 34,
    plan: "Pro",
  },
  {
    name: "CodeCamp Free",
    slug: "codecamp",
    status: "trial",
    students: 48,
    storage: 12,
    plan: "Free",
  },
];

const STATUS_STYLES: Record<string, string> = {
  active: "bg-green-100 text-green-700",
  trial: "bg-yellow-100 text-yellow-700",
};

export function MultiTenantMockup() {
  return (
    <div className="bg-white rounded-xl border border-zen-border/40 shadow-lg overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-zen-border/30 flex items-center justify-between">
        <div>
          <div className="text-[13px] font-semibold text-zen-dark">Super Admin Dashboard</div>
          <div className="text-[11px] text-zen-dark/40">3 institutes . 546 total students</div>
        </div>
        <div className="text-[11px] text-white bg-zen-dark px-3 py-1.5 rounded-lg">
          + New Institute
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px]">
          <thead>
            <tr className="text-[10px] text-zen-dark/40 uppercase tracking-wider">
              <th className="text-left px-5 py-3 font-medium">Institute</th>
              <th className="text-left px-3 py-3 font-medium">Status</th>
              <th className="text-left px-3 py-3 font-medium">Students</th>
              <th className="text-left px-3 py-3 font-medium">Storage</th>
              <th className="text-left px-3 py-3 font-medium">Plan</th>
            </tr>
          </thead>
          <tbody>
            {INSTITUTES.map((inst) => (
              <tr key={inst.slug} className="border-t border-zen-border/20">
                <td className="px-5 py-3">
                  <div className="text-[12px] font-medium text-zen-dark">{inst.name}</div>
                  <div className="text-[10px] text-zen-dark/30">{inst.slug}.zensbot.online</div>
                </td>
                <td className="px-3 py-3">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_STYLES[inst.status]}`}>
                    {inst.status}
                  </span>
                </td>
                <td className="px-3 py-3">
                  <span className="text-[12px] text-zen-dark">{inst.students}</span>
                </td>
                <td className="px-3 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-zen-border/30 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-zen-deep-blue rounded-full"
                        style={{ width: `${inst.storage}%` }}
                      />
                    </div>
                    <span className="text-[10px] text-zen-dark/40">{inst.storage}%</span>
                  </div>
                </td>
                <td className="px-3 py-3">
                  <span className="text-[11px] text-zen-dark/60">{inst.plan}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
