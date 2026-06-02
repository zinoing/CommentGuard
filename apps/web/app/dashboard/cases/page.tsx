export default function CasesPage() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Cases</h1>
        <button className="bg-brand-blue text-white px-4 py-2 rounded-full text-sm hover:bg-brand-blue-dark transition-colors">
          New Case
        </button>
      </div>
      <div className="bg-white rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100 grid grid-cols-4 text-xs font-medium text-gray-500 uppercase tracking-wide">
          <span className="col-span-2">Title</span>
          <span>Status</span>
          <span>Created</span>
        </div>
        <p className="px-6 py-8 text-center text-gray-400 text-sm">No cases created yet.</p>
      </div>
    </div>
  );
}
