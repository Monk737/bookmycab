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

// ---------------------------------------------------------------------------
// Component under test (imported AFTER mocks).
// ---------------------------------------------------------------------------
import { TenantForm } from "@/app/admin/tenants/new/tenant-form";

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
    expect(screen.getByLabelText("Plan band")).toBeInTheDocument();
    expect(screen.getByLabelText("Currency")).toBeInTheDocument();
    expect(screen.getByLabelText("Dispatch adapter")).toBeInTheDocument();
    expect(screen.getByLabelText("Monthly price")).toBeInTheDocument();
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

  it("prefills the monthly price from plan band + currency and clears it for Custom", () => {
    render(<TenantForm />);

    const priceInput = screen.getByLabelText("Monthly price") as HTMLInputElement;
    // Default A-Single / GBP → 500.
    expect(priceInput.value).toBe("500");

    // USD A-Single → 600.
    fireEvent.change(screen.getByLabelText("Currency"), { target: { value: "USD" } });
    expect(priceInput.value).toBe("600");

    // Custom → cleared (no fixed price).
    fireEvent.change(screen.getByLabelText("Plan band"), { target: { value: "Custom" } });
    expect(priceInput.value).toBe("");
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
