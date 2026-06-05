import Link from "next/link";
import { requireUser } from "@/lib/auth/session";
import { getChannels } from "@/lib/dashboard/channels-queries";
import { formatDateTime } from "@/lib/dashboard/format";
import { ChannelIcon } from "@/components/dashboard/channel-icon";
import { StatusBadge } from "@/components/dashboard/status-badge";
import type { ChannelType } from "@/lib/dashboard/types";
import { ChannelTestButton } from "./channels-client";

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  telegram: "Telegram",
  messenger: "Messenger",
  instagram: "Instagram",
  widget: "Widget",
};

function TokenExpiryBadge({ days }: { days: number | null }): React.JSX.Element | null {
  if (days === null) return null;

  const isRed = days <= 1;
  const isAmber = days <= 7 && days > 1;

  if (!isRed && !isAmber) {
    return (
      <span className="text-xs text-gray-500">
        Token expires in {days} day{days !== 1 ? "s" : ""}
      </span>
    );
  }

  const colorClass = isRed
    ? "text-red-600 bg-red-50 border border-red-200"
    : "text-amber-700 bg-amber-50 border border-amber-200";

  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        fill="currentColor"
        className="h-3.5 w-3.5 flex-shrink-0"
      >
        <path
          fillRule="evenodd"
          d="M8.485 2.495c.673-1.167 2.357-1.167 3.03 0l6.28 10.875c.673 1.167-.17 2.625-1.516 2.625H3.72c-1.347 0-2.189-1.458-1.515-2.625L8.485 2.495zM10 5a.75.75 0 01.75.75v3.5a.75.75 0 01-1.5 0v-3.5A.75.75 0 0110 5zm0 9a1 1 0 100-2 1 1 0 000 2z"
          clipRule="evenodd"
        />
      </svg>
      Token expires in {days} day{days !== 1 ? "s" : ""}
    </span>
  );
}

export default async function ChannelsPage({
  params,
}: {
  params: Promise<{ automationId: string }>;
}) {
  const claims = await requireUser();
  const { automationId } = await params;

  if (!claims.tenant_id) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500 text-sm">
        Unable to load channels — no organisation found on your account.
      </div>
    );
  }

  const orgId = claims.tenant_id;
  const canManage = claims.role === "Owner" || claims.role === "Admin";
  const channels = await getChannels(automationId);

  return (
    <div className="space-y-6 p-6">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-blue-900">Channels</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            Messaging channels connected to this automation.
          </p>
        </div>
        <Link
          href="/dashboard/support"
          className="inline-flex items-center gap-1.5 rounded-lg border border-blue-800 px-3 py-1.5 text-xs font-medium text-blue-800 transition-colors duration-200 hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 cursor-pointer"
        >
          <svg
            aria-hidden="true"
            viewBox="0 0 20 20"
            fill="currentColor"
            className="h-3.5 w-3.5"
          >
            <path d="M10.75 4.75a.75.75 0 00-1.5 0v4.5h-4.5a.75.75 0 000 1.5h4.5v4.5a.75.75 0 001.5 0v-4.5h4.5a.75.75 0 000-1.5h-4.5v-4.5z" />
          </svg>
          Add a new channel
        </Link>
      </div>

      {/* Empty state */}
      {channels.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center shadow-sm">
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.5"
            className="mx-auto h-10 w-10 text-gray-300"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M8.625 9.75a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H8.25m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0H12m4.125 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm0 0h-.375m-13.5 3.01c0 1.6 1.123 2.994 2.707 3.227 1.087.16 2.185.283 3.293.369V21l4.184-4.183a1.14 1.14 0 01.778-.332 48.294 48.294 0 005.83-.498c1.585-.233 2.708-1.626 2.708-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z"
            />
          </svg>
          <p className="mt-4 text-sm font-medium text-gray-700">No channels connected</p>
          <p className="mt-1 text-xs text-gray-500">
            Contact support to connect a messaging channel to this automation.
          </p>
          <Link
            href="/dashboard/support"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-blue-800 px-4 py-2 text-sm font-medium text-white transition-colors duration-200 hover:bg-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 focus-visible:ring-offset-2 cursor-pointer"
          >
            Open a support request
          </Link>
        </div>
      )}

      {/* Channel cards */}
      {channels.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3" role="list">
          {channels.map((channel) => (
            <li
              key={channel.id}
              className="rounded-xl bg-white shadow-sm border border-gray-100 p-5 flex flex-col gap-4 transition-shadow duration-200 hover:shadow-md"
            >
              {/* Top row: icon + label + status */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <ChannelIcon
                    type={channel.type as ChannelType}
                    health={channel.health}
                  />
                  <div>
                    <p className="text-sm font-semibold text-blue-900">
                      {CHANNEL_LABEL[channel.type] ?? channel.type}
                    </p>
                    {channel.externalId && (
                      <p className="text-xs text-gray-500 font-mono truncate max-w-[160px]" title={channel.externalId}>
                        {channel.externalId}
                      </p>
                    )}
                  </div>
                </div>
                <StatusBadge status={channel.status} />
              </div>

              {/* Token expiry warning */}
              <TokenExpiryBadge days={channel.tokenExpiresInDays} />

              {/* Last message */}
              <div className="flex flex-col gap-0.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-gray-400">
                  Last message
                </span>
                <span className="text-xs text-gray-600">
                  {channel.lastMessageAt
                    ? formatDateTime(channel.lastMessageAt, "Europe/London")
                    : "—"}
                </span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 flex-wrap pt-1 border-t border-gray-100">
                <ChannelTestButton
                  orgId={orgId}
                  automationId={automationId}
                  channelId={channel.id}
                  canManage={canManage}
                />
                <Link
                  href="/dashboard/support"
                  className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 underline-offset-2 hover:text-blue-800 hover:underline transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-800 rounded cursor-pointer"
                >
                  Reconnect
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
