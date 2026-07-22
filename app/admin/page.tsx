import { AdminPortal } from "./AdminPortal";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  return <AdminPortal initialUser={{ displayName: "UhB 관리자", email: "admin@uhb.local" }} />;
}
