// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — hoisted before component imports.
// ---------------------------------------------------------------------------

// server-only throws outside Next's react-server condition; stub to a no-op so
// any transitive import resolves under the test runner.
vi.mock("server-only", () => ({}));

vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/admin/tenants/new",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Stub the audit module (pulls in service-role client) so importing the action
// module is safe in jsdom.
vi.mock("@/lib/admin/audit", () => ({ writeAudit: vi.fn() }));

// Stub the createTenant server action — tests override the resolved value.
const mockCreateTenant = vi.fn();
vi.mock("@/app/admin/tenants/actions", () => ({
  createTenant: (...args: unknown[]) => mockCreateTenant(...args),
}));

// Stub the tenant detail (lifecycle + invite) server actions. The detail forms
// bind tenantId as the first arg, so these mocks receive (tenantId, prevState,
// formData) for the form actions and (tenantId) for the lifecycle actions.
const mockSendInvite = vi.fn();
const mockSuspendTenant = vi.fn();
const mockEditContract = vi.fn();
const mockReinstateTenant = vi.fn();
const mockMarkChurned = vi.fn();
vi.mock("@/app/admin/tenants/[tenantId]/actions", () => ({
  sendInvite: (...args: unknown[]) => mockSendInvite(...args),
  suspendTenant: (...args: unknown[]) => mockSuspendTenant(...args),
  editContract: (...args: unknown[]) => mockEditContract(...args),
  reinstateTenant: (...args: unknown[]) => mockReinstateTenant(...args),
  markChurned: (...args: unknown[]) => mockMarkChurned(...args),
}));

// ---------------------------------------------------------------------------
// Component under test (imported AFTER mocks).
// ---------------------------------------------------------------------------
import { TenantForm } from "@/app/admin/tenants/new/tenant-form";
import {
  InviteForm,
  LifecycleControls,
} from "@/app/admin/tenants/[tenantId]/tenant-detail-forms";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("TenantForm", () => {
  it("renders the required fields with visible labels", () => {
    render(<TenantForm />);

    expect(screen.getByLabelText("Org name")).toBeInTheDocument();
    expect(screen.getByLabelText("Slug")).toBeInTheDocument();
    expect(screen.getByLabelText("Country")).toBeInTheDocument();
    expect(screen.getByLabelText("Primary contact email")).toBeInTheDocument();
    expect(screen.getByLabelText("Dispatch adapter")).toBeInTheDocument();
    expect(screen.getByLabelText("Product")).toBeInTheDocument();
    // Default product is Chat → chat tier + channel mode render; voice is hidden.
    expect(screen.getByLabelText("Chat tier")).toBeInTheDocument();
    expect(screen.getByLabelText("Channel mode")).toBeInTheDocument();
    expect(screen.queryByLabelText("Voice tier")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create tenant/i })).toBeInTheDocument();
  });

  it("auto-derives the slug from the org name until edited manually", () => {
    render(<TenantForm />);

    const nameInput = screen.getByLabelText("Org name");
    const slugInput = screen.getByLabelText("Slug") as HTMLInputElement;

    fireEvent.change(nameInput, { target: { value: "Speedy Cabs Ltd." } });
    expect(slugInput.value).toBe("speedy-cabs-ltd");

    // Once the user edits the slug, name changes no longer overwrite it.
    fireEvent.change(slugInput, { target: { value: "custom-slug" } });
    fireEvent.change(nameInput, { target: { value: "Other Name" } });
    expect(slugInput.value).toBe("custom-slug");
  });

  it("shows product-specific tier fields (chat / voice / double decker)", () => {
    render(<TenantForm />);
    const product = screen.getByLabelText("Product");

    // Default Chat: chat tier present, voice tier absent.
    expect(screen.getByLabelText("Chat tier")).toBeInTheDocument();
    expect(screen.queryByLabelText("Voice tier")).not.toBeInTheDocument();

    // Voice: voice tier present, chat tier absent.
    fireEvent.change(product, { target: { value: "voice" } });
    expect(screen.getByLabelText("Voice tier")).toBeInTheDocument();
    expect(screen.queryByLabelText("Chat tier")).not.toBeInTheDocument();

    // Double Decker: both present.
    fireEvent.change(product, { target: { value: "double_decker" } });
    expect(screen.getByLabelText("Chat tier")).toBeInTheDocument();
    expect(screen.getByLabelText("Voice tier")).toBeInTheDocument();
  });

  it("renders field-level errors returned by the action", async () => {
    mockCreateTenant.mockResolvedValue({
      fieldErrors: {
        name: ["Org name is required."],
        contact_email: ["Enter a valid contact email."],
      },
      formError: null,
    });

    render(<TenantForm />);
    fireEvent.click(screen.getByRole("button", { name: /create tenant/i }));

    await waitFor(() =>
      expect(screen.getByText("Org name is required.")).toBeInTheDocument(),
    );
    expect(screen.getByText("Enter a valid contact email.")).toBeInTheDocument();
  });

  it("renders a form-level error in the aria-live banner", async () => {
    mockCreateTenant.mockResolvedValue({
      fieldErrors: {},
      formError: "Could not create the tenant. Please try again.",
    });

    render(<TenantForm />);
    fireEvent.click(screen.getByRole("button", { name: /create tenant/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Could not create the tenant. Please try again."),
      ).toBeInTheDocument(),
    );
    const banner = document.querySelector('[role="alert"][aria-live="polite"]');
    expect(banner?.textContent).toContain("Could not create the tenant");
  });

  it("calls createTenant on submit with valid input", async () => {
    mockCreateTenant.mockResolvedValue({ fieldErrors: {}, formError: null });

    render(<TenantForm />);

    fireEvent.change(screen.getByLabelText("Org name"), {
      target: { value: "Speedy Cabs" },
    });
    fireEvent.change(screen.getByLabelText("Country"), {
      target: { value: "United Kingdom" },
    });
    fireEvent.change(screen.getByLabelText("Primary contact email"), {
      target: { value: "owner@speedycabs.co.uk" },
    });

    fireEvent.click(screen.getByRole("button", { name: /create tenant/i }));

    await waitFor(() => expect(mockCreateTenant).toHaveBeenCalled());
  });
});

describe("InviteForm", () => {
  it("defaults the email to the tenant contact and renders email + role fields", () => {
    render(<InviteForm tenantId="t-1" defaultEmail="owner@speedycabs.co.uk" />);

    const email = screen.getByLabelText("Email") as HTMLInputElement;
    expect(email.value).toBe("owner@speedycabs.co.uk");
    expect(screen.getByLabelText("Role")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /send invite/i })).toBeInTheDocument();
  });

  it("surfaces a field error returned by sendInvite", async () => {
    mockSendInvite.mockResolvedValue({
      fieldErrors: { email: ["Enter a valid email address."] },
      formError: null,
    });

    render(<InviteForm tenantId="t-1" defaultEmail={null} />);
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument(),
    );
  });

  it("calls sendInvite on submit with the chosen email + role", async () => {
    mockSendInvite.mockResolvedValue({ fieldErrors: {}, formError: null, ok: true });

    render(<InviteForm tenantId="t-1" defaultEmail="owner@speedycabs.co.uk" />);
    fireEvent.change(screen.getByLabelText("Role"), { target: { value: "Admin" } });
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() => expect(mockSendInvite).toHaveBeenCalled());
    // The bound tenantId is the first arg; the submitted FormData is the last.
    const lastCall = mockSendInvite.mock.calls.at(-1) as unknown[];
    expect(lastCall[0]).toBe("t-1");
    const formData = lastCall.at(-1) as FormData;
    expect(formData.get("email")).toBe("owner@speedycabs.co.uk");
    expect(formData.get("role")).toBe("Admin");
  });

  it("renders the success banner when sendInvite returns ok:true", async () => {
    mockSendInvite.mockResolvedValue({ fieldErrors: {}, formError: null, ok: true });

    render(<InviteForm tenantId="t-1" defaultEmail="owner@speedycabs.co.uk" />);
    fireEvent.click(screen.getByRole("button", { name: /send invite/i }));

    await waitFor(() =>
      expect(screen.getByText("Invite sent.")).toBeInTheDocument(),
    );
    const banner = document.querySelector('[role="status"][aria-live="polite"]');
    expect(banner?.textContent).toContain("Invite sent.");
  });
});

describe("LifecycleControls", () => {
  it("calls suspendTenant when the suspend control is used on an active tenant", async () => {
    render(<LifecycleControls tenantId="t-1" status="active" />);

    fireEvent.click(screen.getByRole("button", { name: /suspend/i }));

    await waitFor(() => expect(mockSuspendTenant).toHaveBeenCalled());
    expect((mockSuspendTenant.mock.calls.at(-1) as unknown[])[0]).toBe("t-1");
  });

  it("offers reinstate (not suspend) for a suspended tenant", () => {
    render(<LifecycleControls tenantId="t-1" status="suspended" />);

    expect(screen.getByRole("button", { name: /reinstate/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^suspend$/i })).not.toBeInTheDocument();
  });
});
