"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DataTable } from "@/components/dashboard/data-table";
import { formatDateTime } from "@/lib/dashboard/format";
import { inviteMember, changeRole, revokeMember } from "./actions";
import type { MemberRow, AuditRow } from "@/lib/dashboard/team-queries";

interface AutomationStub {
  id: string;
  name: string;
}

interface Props {
  orgId: string;
  isOwner: boolean;
  members: MemberRow[];
  automations: AutomationStub[];
  audit: AuditRow[];
}

export function TeamClient({ orgId, isOwner, members, automations, audit }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rowErrors, setRowErrors] = useState<Record<string, string>>({});
  const [globalError] = useState<string | null>(null);

  // Invite form state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<"Owner" | "Admin" | "Viewer">("Viewer");
  const [inviteRestrictions, setInviteRestrictions] = useState<string[]>([]);
  const [inviteStatus, setInviteStatus] = useState<"idle" | "sent" | "error">("idle");
  const [inviteError, setInviteError] = useState<string | null>(null);

  function setRowError(userId: string, msg: string) {
    setRowErrors((prev) => ({ ...prev, [userId]: msg }));
  }

  function clearRowError(userId: string) {
    setRowErrors((prev) => {
      const next = { ...prev };
      delete next[userId];
      return next;
    });
  }

  function handleRoleChange(userId: string, role: string) {
    clearRowError(userId);
    startTransition(async () => {
      const result = await changeRole(orgId, userId, role);
      if (result.ok) {
        router.refresh();
      } else {
        setRowError(userId, result.error ?? "Could not update role.");
      }
    });
  }

  function handleRevoke(userId: string, displayName: string) {
    if (!window.confirm(`Remove ${displayName} from the team?`)) return;
    clearRowError(userId);
    startTransition(async () => {
      const result = await revokeMember(orgId, userId);
      if (result.ok) {
        router.refresh();
      } else {
        setRowError(userId, result.error ?? "Could not remove member.");
      }
    });
  }

  async function handleInviteSubmit(e: React.FormEvent) {
    e.preventDefault();
    setInviteStatus("idle");
    setInviteError(null);
    const result = await inviteMember(orgId, {
      email: inviteEmail,
      role: inviteRole,
      automationRestrictions: inviteRole === "Viewer" ? inviteRestrictions : [],
    });
    if (result.ok) {
      setInviteStatus("sent");
      setInviteEmail("");
      setInviteRole("Viewer");
      setInviteRestrictions([]);
      router.refresh();
    } else {
      setInviteStatus("error");
      setInviteError(result.error ?? "Failed to send invite.");
    }
  }

  function toggleRestriction(id: string) {
    setInviteRestrictions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  const memberColumns = [
    {
      key: "name",
      header: "Name",
      render: (row: MemberRow) => (
        <span className="font-medium text-slate-900">{row.fullName ?? row.email ?? "Unknown"}</span>
      ),
    },
    {
      key: "email",
      header: "Email",
      render: (row: MemberRow) => <span>{row.email ?? "—"}</span>,
    },
    {
      key: "role",
      header: "Role",
      render: (row: MemberRow) => {
        if (isOwner) {
          return (
            <select
              value={row.role}
              disabled={isPending}
              aria-label={`Role for ${row.fullName ?? row.email}`}
              className="rounded border border-slate-300 bg-white px-2 py-1 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-800 cursor-pointer disabled:opacity-50"
              onChange={(e) => handleRoleChange(row.userId, e.target.value)}
            >
              <option value="Owner">Owner</option>
              <option value="Admin">Admin</option>
              <option value="Viewer">Viewer</option>
            </select>
          );
        }
        return <span>{row.role}</span>;
      },
    },
    {
      key: "lastLogin",
      header: "Last Login",
      render: (row: MemberRow) => (
        <span className="text-slate-500">{formatDateTime(row.lastLoginAt, "Europe/London")}</span>
      ),
    },
    {
      key: "automations",
      header: "Automations Visible",
      render: (row: MemberRow) => {
        if (!row.automationRestrictions || row.automationRestrictions.length === 0) {
          return <span className="text-slate-500">All</span>;
        }
        const names = row.automationRestrictions
          .map((id) => automations.find((a) => a.id === id)?.name ?? id)
          .join(", ");
        return <span className="text-slate-700">{names}</span>;
      },
    },
    ...(isOwner
      ? [
          {
            key: "actions",
            header: "Actions",
            render: (row: MemberRow) => {
              const displayName = row.fullName ?? row.email ?? row.userId;
              const err = rowErrors[row.userId];
              return (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    disabled={isPending}
                    onClick={() => handleRevoke(row.userId, displayName)}
                    className="rounded border border-red-200 bg-red-50 px-3 py-1 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 focus:outline-none focus:ring-2 focus:ring-blue-800 cursor-pointer disabled:opacity-50"
                  >
                    Revoke
                  </button>
                  {err && <p className="text-xs text-red-600">{err}</p>}
                </div>
              );
            },
          },
        ]
      : []),
  ];

  const auditColumns = [
    {
      key: "action",
      header: "Action",
      render: (row: AuditRow) => (
        <span className="font-mono text-xs text-slate-700">{row.action}</span>
      ),
    },
    {
      key: "target",
      header: "Target",
      render: (row: AuditRow) => (
        <span className="text-slate-600">
          {row.targetType && row.targetId
            ? `${row.targetType}/${row.targetId}`
            : row.targetType ?? "—"}
        </span>
      ),
    },
    {
      key: "when",
      header: "When",
      render: (row: AuditRow) => (
        <span className="text-slate-500">{formatDateTime(row.ts, "Europe/London")}</span>
      ),
    },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 space-y-10">
      <header>
        <h1 className="text-2xl font-semibold text-blue-900">Team</h1>
        <p className="mt-1 text-sm text-slate-500">
          Manage team members and their access to your automations.
        </p>
      </header>

      {!isOwner && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Only Owners can manage the team.
        </p>
      )}

      {globalError && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {globalError}
        </p>
      )}

      {/* Members table */}
      <section aria-labelledby="members-heading">
        <h2 id="members-heading" className="mb-4 text-base font-semibold text-slate-800">
          Members
        </h2>
        <DataTable
          columns={memberColumns}
          rows={members}
          getRowKey={(row) => row.userId}
          emptyMessage="No team members found."
        />
      </section>

      {/* Invite form — Owner only */}
      {isOwner && (
        <section aria-labelledby="invite-heading">
          <h2 id="invite-heading" className="mb-4 text-base font-semibold text-slate-800">
            Invite a new member
          </h2>
          <form
            onSubmit={handleInviteSubmit}
            className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5"
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <div className="flex flex-col gap-1">
                <label htmlFor="invite-email" className="text-sm font-medium text-slate-700">
                  Email address
                </label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="colleague@example.com"
                  className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-800"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="invite-role" className="text-sm font-medium text-slate-700">
                  Role
                </label>
                <select
                  id="invite-role"
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as typeof inviteRole)}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-800 cursor-pointer"
                >
                  <option value="Owner">Owner</option>
                  <option value="Admin">Admin</option>
                  <option value="Viewer">Viewer</option>
                </select>
              </div>
            </div>

            {inviteRole === "Viewer" && automations.length > 0 && (
              <fieldset>
                <legend className="mb-2 text-sm font-medium text-slate-700">
                  Restrict to specific automations (leave unchecked for all)
                </legend>
                <div className="flex flex-wrap gap-3">
                  {automations.map((a) => (
                    <label
                      key={a.id}
                      htmlFor={`restrict-${a.id}`}
                      className="flex items-center gap-2 cursor-pointer text-sm text-slate-700"
                    >
                      <input
                        id={`restrict-${a.id}`}
                        type="checkbox"
                        checked={inviteRestrictions.includes(a.id)}
                        onChange={() => toggleRestriction(a.id)}
                        className="h-4 w-4 rounded border-slate-300 text-blue-800 focus:ring-blue-800 cursor-pointer"
                      />
                      {a.name}
                    </label>
                  ))}
                </div>
              </fieldset>
            )}

            <div className="flex items-center gap-4">
              <button
                type="submit"
                className="rounded-lg bg-amber-400 px-5 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 focus:outline-none focus:ring-2 focus:ring-blue-800 cursor-pointer"
              >
                Send invite
              </button>
              {inviteStatus === "sent" && (
                <p className="text-sm text-green-700">Invite sent.</p>
              )}
              {inviteStatus === "error" && inviteError && (
                <p className="text-sm text-red-600">{inviteError}</p>
              )}
            </div>
          </form>
        </section>
      )}

      {/* Audit trail — Owner only */}
      {isOwner && (
        <section aria-labelledby="audit-heading">
          <h2 id="audit-heading" className="mb-4 text-base font-semibold text-slate-800">
            Audit trail
          </h2>
          <DataTable
            columns={auditColumns}
            rows={audit}
            getRowKey={(row) => `${row.action}-${row.ts}`}
            emptyMessage="No audit events recorded yet."
          />
        </section>
      )}
    </main>
  );
}
