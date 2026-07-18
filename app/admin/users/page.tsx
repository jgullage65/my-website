import Link from "next/link";
import { requireAdmin } from "@/app/lib/admin/auth";
import { listAdminUsers } from "@/app/lib/admin/repository";
import { Badge, EmptyState, PageHeader, Pagination, SearchBar, card, formatDate, formatDateTime, td, th } from "../_components/AdminUi";

export default async function AdminUsersPage({ searchParams }: { searchParams: { q?: string; sort?: string; page?: string } }) {
  await requireAdmin(); const q = (searchParams.q || "").toLowerCase(); const sort = searchParams.sort || "activity";
  let users = (await listAdminUsers()).filter((u) => !q || [u.email,u.ownerName,u.businessName].some((v) => v.toLowerCase().includes(q)));
  users.sort((a,b) => sort === "name" ? a.businessName.localeCompare(b.businessName) : sort === "created" ? +new Date(b.createdAt)-+new Date(a.createdAt) : +new Date(b.lastActivity)-+new Date(a.lastActivity));
  const size=20, pages=Math.max(1,Math.ceil(users.length/size)), page=Math.min(pages,Math.max(1,Number(searchParams.page)||1)); users=users.slice((page-1)*size,page*size);
  return <div className="space-y-6"><PageHeader eyebrow="Directory" title="Users" description="Authenticated AI Builder owners and their project activity." />
    <SearchBar placeholder="Search business, owner, or email" defaultValue={searchParams.q} extras={<select name="sort" defaultValue={sort} className="rounded-xl border border-white/10 bg-[#020611] px-4 py-2.5 text-sm text-slate-300"><option value="activity">Last activity</option><option value="created">Created date</option><option value="name">Business name</option></select>} />
    {!users.length ? <EmptyState title="No authenticated users yet" detail="Anonymous AI Builder projects remain available on the Projects page. Users will appear here after identity is connected." /> : <div className={`${card} overflow-x-auto`}><table className="w-full min-w-[950px]"><thead className="border-b border-white/[.06]"><tr>{["Business","Owner","Email","Created","Projects","Purchase","Last activity"].map(x=><th key={x} className={th}>{x}</th>)}</tr></thead><tbody className="divide-y divide-white/[.05]">{users.map(u=><tr key={u.email} className="hover:bg-white/[.025]"><td className={`${td} font-bold text-white`}><Link href={`/admin/projects?owner=${encodeURIComponent(u.email)}`} className="hover:text-amber-300">{u.businessName}</Link></td><td className={td}>{u.ownerName}</td><td className={td}>{u.email}</td><td className={td}>{formatDate(u.createdAt)}</td><td className={td}>{u.projectCount}</td><td className={td}><Badge tone={u.purchaseStatus === "none" ? "neutral":"gold"}>{u.purchaseStatus}</Badge></td><td className={td}>{formatDateTime(u.lastActivity)}</td></tr>)}</tbody></table></div>}
    <Pagination page={page} pages={pages} params={{q:searchParams.q,sort}} /></div>;
}
