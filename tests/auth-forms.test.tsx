// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react";

// ---------------------------------------------------------------------------
// Mocks — must be hoisted before component imports.
// ---------------------------------------------------------------------------

// next/navigation is not available in jsdom; stub it out.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  usePathname: () => "/login",
  redirect: vi.fn(),
}));

// next/link renders a plain <a> in tests — stub enough for the component.
vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: React.ReactNode; [key: string]: unknown }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

// Stub all server actions — tests override per-test as needed.
const mockSignIn = vi.fn();
const mockRequestReset = vi.fn();
const mockUpdatePassword = vi.fn();
const mockAcceptInvite = vi.fn();
vi.mock("@/app/(auth)/actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
  requestReset: (...args: unknown[]) => mockRequestReset(...args),
  updatePassword: (...args: unknown[]) => mockUpdatePassword(...args),
  acceptInvite: (...args: unknown[]) => mockAcceptInvite(...args),
}));

// Stub the browser Supabase client used by ResetForm for session detection.
// ResetForm uses onAuthStateChange (PASSWORD_RECOVERY event) to detect a
// recovery session — getSession is no longer called by that component.
const mockOnAuthStateChange = vi.fn();
vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (...args: Parameters<typeof mockOnAuthStateChange>) =>
        mockOnAuthStateChange(...args),
    },
  }),
}));

// ---------------------------------------------------------------------------
// Components under test (imported AFTER mocks are registered).
// ---------------------------------------------------------------------------
import { LoginForm } from "@/app/(auth)/login/login-form";
import { ForgotForm } from "@/app/(auth)/forgot-password/forgot-form";
import { ResetForm } from "@/app/(auth)/reset-password/reset-form";
import { AcceptForm } from "@/app/(auth)/accept-invite/accept-form";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("LoginForm", () => {
  it("renders email and password fields with visible labels", () => {
    render(<LoginForm />);

    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it("renders a submit button", () => {
    render(<LoginForm />);
    expect(screen.getByRole("button", { name: /sign in/i })).toBeInTheDocument();
  });

  it("renders a forgot-password link", () => {
    render(<LoginForm />);
    const link = screen.getByRole("link", { name: /forgot password/i });
    expect(link).toHaveAttribute("href", "/forgot-password");
  });

  it("renders the invite-only notice", () => {
    render(<LoginForm />);
    expect(screen.getByText(/access is invite-only/i)).toBeInTheDocument();
  });

  it("does not show a form error banner on initial render", () => {
    render(<LoginForm />);
    // Only the card-level alert matters here — its text should be empty.
    const cardAlert = document.querySelector('[role="alert"][aria-live="polite"]');
    expect(cardAlert?.textContent?.trim()).toBe("");
  });

  it("empty submit: action returns field errors and they render in the DOM", async () => {
    // When both fields are empty the action returns field-level errors via Zod.
    mockSignIn.mockResolvedValue({
      fieldErrors: {
        email: ["Please enter a valid email address."],
        password: ["Password is required."],
      },
      formError: null,
    });

    render(<LoginForm />);

    // Submit without filling in either field.
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    // Both field error messages must appear in the DOM.
    await waitFor(() =>
      expect(
        screen.getByText("Please enter a valid email address."),
      ).toBeInTheDocument(),
    );
    expect(screen.getByText("Password is required.")).toBeInTheDocument();
  });

  it("shows a server-returned form error when the action resolves with formError", async () => {
    // Simulate a failed sign-in returning a form-level error.
    mockSignIn.mockResolvedValue({
      fieldErrors: {},
      formError: "Invalid email or password. Please try again.",
    });

    render(<LoginForm />);

    const emailInput = screen.getByLabelText(/email address/i);
    const passwordInput = screen.getByLabelText(/password/i);
    const submit = screen.getByRole("button", { name: /sign in/i });

    fireEvent.change(emailInput, { target: { value: "driver@example.com" } });
    fireEvent.change(passwordInput, { target: { value: "wrongpassword" } });
    fireEvent.click(submit);

    // The error message must actually appear in the aria-live alert banner.
    await waitFor(() =>
      expect(
        screen.getByText("Invalid email or password. Please try again."),
      ).toBeInTheDocument(),
    );

    // Confirm it is inside the role="alert" aria-live banner.
    const banner = document.querySelector('[role="alert"][aria-live="polite"]');
    expect(banner?.textContent).toBe(
      "Invalid email or password. Please try again.",
    );
  });

  it("submitting valid inputs calls the signIn action", async () => {
    mockSignIn.mockResolvedValue({ fieldErrors: {}, formError: null });

    render(<LoginForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "admin@example.com" },
    });
    fireEvent.change(screen.getByLabelText(/password/i), {
      target: { value: "securepassword" },
    });

    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(mockSignIn).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// ForgotForm tests
// ---------------------------------------------------------------------------

describe("ForgotForm", () => {
  it("renders an email field with a visible label", () => {
    render(<ForgotForm />);
    expect(screen.getByLabelText(/email address/i)).toBeInTheDocument();
  });

  it("renders a submit button with the correct label", () => {
    render(<ForgotForm />);
    expect(screen.getByRole("button", { name: /send reset link/i })).toBeInTheDocument();
  });

  it("renders a back-to-sign-in link", () => {
    render(<ForgotForm />);
    const link = screen.getByRole("link", { name: /back to sign in/i });
    expect(link).toHaveAttribute("href", "/login");
  });

  it("does not show a form error banner on initial render", () => {
    render(<ForgotForm />);
    const cardAlert = document.querySelector('[role="alert"][aria-live="polite"]');
    expect(cardAlert?.textContent?.trim()).toBe("");
  });

  it("invalid email: action returns a field error and it renders in the DOM", async () => {
    mockRequestReset.mockResolvedValue({
      fieldErrors: { email: ["Please enter a valid email address."] },
      formError: null,
      successMessage: null,
    });

    render(<ForgotForm />);
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Please enter a valid email address."),
      ).toBeInTheDocument(),
    );
  });

  it("success: action returns successMessage and the confirmation renders — form hidden", async () => {
    mockRequestReset.mockResolvedValue({
      fieldErrors: {},
      formError: null,
      successMessage: "If that email exists, we've sent a reset link.",
    });

    render(<ForgotForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "user@example.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/if that email exists/i),
      ).toBeInTheDocument(),
    );

    // The confirmation message is shown in a status region
    const statusEl = screen.getByRole("status");
    expect(statusEl.textContent).toContain("we've sent a reset link");

    // The submit button (and therefore the form) should no longer be visible
    expect(screen.queryByRole("button", { name: /send reset link/i })).not.toBeInTheDocument();
  });

  it("submitting a valid email calls the requestReset action", async () => {
    mockRequestReset.mockResolvedValue({
      fieldErrors: {},
      formError: null,
      successMessage: null,
    });

    render(<ForgotForm />);

    fireEvent.change(screen.getByLabelText(/email address/i), {
      target: { value: "driver@cabco.com" },
    });
    fireEvent.click(screen.getByRole("button", { name: /send reset link/i }));

    await waitFor(() => expect(mockRequestReset).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// ResetForm tests
// ---------------------------------------------------------------------------

// Helper: returns a mock onAuthStateChange that immediately fires `event` then
// returns a no-op subscription object.
function mockRecoveryEvent(event: string) {
  return mockOnAuthStateChange.mockImplementation((callback: (event: string) => void) => {
    callback(event);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
}

// Helper: returns a mock onAuthStateChange whose callback is never invoked
// (simulates a pending auth state — keeps the component in "loading").
function mockPendingEvent() {
  return mockOnAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));
}

describe("ResetForm", () => {
  it("shows a loading state while the session check is pending", () => {
    // onAuthStateChange never calls the callback → component stays in "loading"
    mockPendingEvent();
    render(<ResetForm />);
    expect(screen.getByText(/verifying your reset link/i)).toBeInTheDocument();
  });

  it("shows the invalid-link state when a non-recovery auth event fires", async () => {
    // A normally logged-in user hitting this page fires SIGNED_IN, not PASSWORD_RECOVERY
    mockRecoveryEvent("SIGNED_IN");
    render(<ResetForm />);

    await waitFor(() =>
      expect(screen.getByText(/link invalid or expired/i)).toBeInTheDocument(),
    );

    // A link to request a new reset link must be present
    const link = screen.getByRole("link", { name: /request a new reset link/i });
    expect(link).toHaveAttribute("href", "/forgot-password");

    // The password form must NOT be present
    expect(screen.queryByLabelText(/new password/i)).not.toBeInTheDocument();
  });

  it("renders password fields when a PASSWORD_RECOVERY event fires", async () => {
    mockRecoveryEvent("PASSWORD_RECOVERY");

    render(<ResetForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("New password")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Confirm new password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set new password/i })).toBeInTheDocument();
  });

  it("password mismatch: action returns field error and it renders in the DOM", async () => {
    mockRecoveryEvent("PASSWORD_RECOVERY");
    mockUpdatePassword.mockResolvedValue({
      fieldErrors: { confirmPassword: ["Passwords do not match."] },
      formError: null,
    });

    render(<ResetForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("New password")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "password1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "password2" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() =>
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument(),
    );
  });

  it("short password: action returns field error for minimum length", async () => {
    mockRecoveryEvent("PASSWORD_RECOVERY");
    mockUpdatePassword.mockResolvedValue({
      fieldErrors: { password: ["Password must be at least 8 characters."] },
      formError: null,
    });

    render(<ResetForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("New password")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "short" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() =>
      expect(
        screen.getByText("Password must be at least 8 characters."),
      ).toBeInTheDocument(),
    );
  });

  it("form error: shows server error in the aria-live banner", async () => {
    mockRecoveryEvent("PASSWORD_RECOVERY");
    mockUpdatePassword.mockResolvedValue({
      fieldErrors: {},
      formError: "Failed to update password. Your reset link may have expired. Please request a new one.",
    });

    render(<ResetForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("New password")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "newpassword1" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "newpassword1" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() =>
      expect(
        screen.getByText(/failed to update password/i),
      ).toBeInTheDocument(),
    );

    // Must be inside the aria-live banner
    const banner = document.querySelector('[role="alert"][aria-live="polite"]');
    expect(banner?.textContent).toContain("Failed to update password");
  });

  it("submitting matching passwords calls the updatePassword action", async () => {
    mockRecoveryEvent("PASSWORD_RECOVERY");
    mockUpdatePassword.mockResolvedValue({ fieldErrors: {}, formError: null });

    render(<ResetForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("New password")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("New password"), {
      target: { value: "securepass99" },
    });
    fireEvent.change(screen.getByLabelText("Confirm new password"), {
      target: { value: "securepass99" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set new password/i }));

    await waitFor(() => expect(mockUpdatePassword).toHaveBeenCalled());
  });
});

// ---------------------------------------------------------------------------
// AcceptForm tests
// ---------------------------------------------------------------------------

// Re-use the same mockOnAuthStateChange helper defined above for ResetForm.
// Helper: fires the given event immediately and returns a no-op subscription.
function mockInviteEvent(event: string) {
  return mockOnAuthStateChange.mockImplementation((callback: (event: string) => void) => {
    callback(event);
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
}

// Helper: never fires the callback (loading state).
function mockInvitePendingEvent() {
  return mockOnAuthStateChange.mockImplementation(() => ({
    data: { subscription: { unsubscribe: vi.fn() } },
  }));
}

describe("AcceptForm", () => {
  it("shows a loading state while the session check is pending", () => {
    mockInvitePendingEvent();
    render(<AcceptForm />);
    expect(screen.getByText(/verifying your invite link/i)).toBeInTheDocument();
  });

  it("shows the invalid-invite state when a non-session event fires", async () => {
    mockInviteEvent("SIGNED_OUT");
    render(<AcceptForm />);

    await waitFor(() =>
      expect(screen.getByText(/invitation invalid or expired/i)).toBeInTheDocument(),
    );

    // Guidance text must be present
    expect(screen.getByText(/contact your administrator/i)).toBeInTheDocument();

    // The set-up form must NOT be rendered
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it("renders full name (optional), password, and confirm fields on a valid SIGNED_IN event", async () => {
    mockInviteEvent("SIGNED_IN");
    render(<AcceptForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /set up account/i })).toBeInTheDocument();
  });

  it("renders full name (optional), password, and confirm fields on INITIAL_SESSION event", async () => {
    mockInviteEvent("INITIAL_SESSION");
    render(<AcceptForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toBeInTheDocument(),
    );
    expect(screen.getByLabelText("Full name")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toBeInTheDocument();
  });

  it("full name field is optional — form can be submitted without it", async () => {
    mockInviteEvent("SIGNED_IN");
    mockAcceptInvite.mockResolvedValue({ fieldErrors: {}, formError: null });
    render(<AcceptForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toBeInTheDocument(),
    );

    // Leave full name empty
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "securepass99" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "securepass99" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set up account/i }));

    await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalled());
  });

  it("password mismatch: action returns field error and it renders in the DOM", async () => {
    mockInviteEvent("SIGNED_IN");
    mockAcceptInvite.mockResolvedValue({
      fieldErrors: { confirmPassword: ["Passwords do not match."] },
      formError: null,
    });
    render(<AcceptForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "password1!" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "password2!" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set up account/i }));

    await waitFor(() =>
      expect(screen.getByText("Passwords do not match.")).toBeInTheDocument(),
    );
  });

  it("valid submit calls the acceptInvite action", async () => {
    mockInviteEvent("SIGNED_IN");
    mockAcceptInvite.mockResolvedValue({ fieldErrors: {}, formError: null });
    render(<AcceptForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Full name"), {
      target: { value: "Jane Smith" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "securepass99" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "securepass99" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set up account/i }));

    await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalled());
  });

  it("shows a server form error in the aria-live banner", async () => {
    mockInviteEvent("SIGNED_IN");
    mockAcceptInvite.mockResolvedValue({
      fieldErrors: {},
      formError: "Failed to set up your account. Your invite link may have expired. Please contact your administrator.",
    });
    render(<AcceptForm />);

    await waitFor(() =>
      expect(screen.getByLabelText("Password")).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "securepass99" },
    });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "securepass99" },
    });
    fireEvent.click(screen.getByRole("button", { name: /set up account/i }));

    await waitFor(() =>
      expect(screen.getByText(/failed to set up your account/i)).toBeInTheDocument(),
    );

    const banner = document.querySelector('[role="alert"][aria-live="polite"]');
    expect(banner?.textContent).toContain("Failed to set up your account");
  });
});
