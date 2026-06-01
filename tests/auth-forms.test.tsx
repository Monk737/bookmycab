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

// MFA method stubs — used by MfaEnroll and MfaChallenge.
const mockMfaEnroll = vi.fn();
const mockMfaChallengeAndVerify = vi.fn();

vi.mock("@/lib/supabase/browser", () => ({
  createClient: () => ({
    auth: {
      onAuthStateChange: (...args: Parameters<typeof mockOnAuthStateChange>) =>
        mockOnAuthStateChange(...args),
      mfa: {
        enroll: (...args: unknown[]) => mockMfaEnroll(...args),
        challengeAndVerify: (...args: unknown[]) => mockMfaChallengeAndVerify(...args),
      },
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
import { MfaEnroll } from "@/app/(auth)/mfa/mfa-enroll";
import { MfaChallenge } from "@/app/(auth)/mfa/mfa-challenge";

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

  it("renders a session-expired notice when the notice prop is provided", () => {
    render(<LoginForm notice="Your session expired. Please sign in again." />);
    expect(
      screen.getByText("Your session expired. Please sign in again."),
    ).toBeInTheDocument();
  });

  it("does not render a notice when the notice prop is omitted", () => {
    render(<LoginForm />);
    expect(
      screen.queryByRole("status"),
    ).not.toBeInTheDocument();
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

// Re-use mockRecoveryEvent / mockPendingEvent defined above for ResetForm —
// they share the same mockOnAuthStateChange stub so the helpers are identical.
// mockInviteEvent  → alias for mockRecoveryEvent (fires event immediately)
// mockInvitePendingEvent → alias for mockPendingEvent (never fires callback)
const mockInviteEvent = mockRecoveryEvent;
const mockInvitePendingEvent = mockPendingEvent;

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

// ---------------------------------------------------------------------------
// MfaEnroll tests
// ---------------------------------------------------------------------------

// Stable mock QR/secret values used across enroll tests.
const MOCK_FACTOR_ID = "factor-abc-123";
const MOCK_QR_CODE = "data:image/svg+xml;utf-8,<svg/>";
const MOCK_SECRET = "JBSWY3DPEHPK3PXP";

// Helper: configures mockMfaEnroll to resolve with a valid TOTP enroll response.
function mockEnrollSuccess() {
  mockMfaEnroll.mockResolvedValue({
    data: {
      id: MOCK_FACTOR_ID,
      type: "totp",
      totp: { qr_code: MOCK_QR_CODE, secret: MOCK_SECRET, uri: "otpauth://totp/test" },
    },
    error: null,
  });
}

// Helper: configures mockMfaEnroll to resolve with an error.
function mockEnrollError(message: string) {
  mockMfaEnroll.mockResolvedValue({
    data: null,
    error: { message },
  });
}

// Mock window.location.assign so tests can assert on navigation without errors.
const mockLocationAssign = vi.fn();
Object.defineProperty(window, "location", {
  value: { assign: mockLocationAssign },
  writable: true,
});

describe("MfaEnroll", () => {
  it("shows a loading state while enroll is pending", () => {
    // enroll never resolves during this render.
    mockMfaEnroll.mockReturnValue(new Promise(() => {}));
    render(<MfaEnroll redirectTarget="/dashboard" />);
    expect(screen.getByText(/preparing your setup/i)).toBeInTheDocument();
  });

  it("renders the QR image and secret after enroll resolves", async () => {
    mockEnrollSuccess();
    render(<MfaEnroll redirectTarget="/dashboard" />);

    // QR image should appear with the correct src.
    const qr = await screen.findByRole("img", { name: /totp qr code/i });
    expect(qr).toHaveAttribute("src", MOCK_QR_CODE);

    // Secret text should appear somewhere in the document (inside <details>).
    expect(screen.getByText(MOCK_SECRET)).toBeInTheDocument();
  });

  it("renders a 6-digit code input field", async () => {
    mockEnrollSuccess();
    render(<MfaEnroll redirectTarget="/dashboard" />);

    const input = await screen.findByLabelText(/6-digit code/i);
    expect(input).toBeInTheDocument();
  });

  it("calls challengeAndVerify with the entered code on submit", async () => {
    mockEnrollSuccess();
    mockMfaChallengeAndVerify.mockResolvedValue({ error: null });

    render(<MfaEnroll redirectTarget="/dashboard" />);

    const input = await screen.findByLabelText(/6-digit code/i);
    fireEvent.change(input, { target: { value: "123456" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and enable/i }));

    await waitFor(() =>
      expect(mockMfaChallengeAndVerify).toHaveBeenCalledWith({
        factorId: MOCK_FACTOR_ID,
        code: "123456",
      }),
    );
  });

  it("calls window.location.assign to the redirect target on success", async () => {
    mockEnrollSuccess();
    mockMfaChallengeAndVerify.mockResolvedValue({ error: null });

    render(<MfaEnroll redirectTarget="/admin" />);

    const input = await screen.findByLabelText(/6-digit code/i);
    fireEvent.change(input, { target: { value: "654321" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and enable/i }));

    await waitFor(() => expect(mockLocationAssign).toHaveBeenCalledWith("/admin"));
  });

  it("shows an inline error when challengeAndVerify returns an error", async () => {
    mockEnrollSuccess();
    mockMfaChallengeAndVerify.mockResolvedValue({
      error: { message: "Invalid TOTP code entered. Please try again." },
    });

    render(<MfaEnroll redirectTarget="/dashboard" />);

    const input = await screen.findByLabelText(/6-digit code/i);
    fireEvent.change(input, { target: { value: "000000" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and enable/i }));

    // The Field component renders the error in a <p role="alert"> element.
    await waitFor(() => {
      const fieldError = document.querySelector('p[role="alert"]');
      expect(fieldError).toBeInTheDocument();
      expect(fieldError?.textContent).toMatch(/invalid totp code/i);
    });
  });

  it("shows an error card when enroll itself fails", async () => {
    mockEnrollError("Too many enrolled factors.");
    render(<MfaEnroll redirectTarget="/dashboard" />);

    await waitFor(() =>
      expect(screen.getByText(/too many enrolled factors/i)).toBeInTheDocument(),
    );
  });

  it("short code: shows length-guard error and does NOT call challengeAndVerify", async () => {
    mockEnrollSuccess();
    render(<MfaEnroll redirectTarget="/dashboard" />);

    const input = await screen.findByLabelText(/6-digit code/i);
    // Enter a code that is too short (only 4 digits)
    fireEvent.change(input, { target: { value: "1234" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and enable/i }));

    // The length-guard error must appear inline.
    await waitFor(() => {
      const fieldError = document.querySelector('p[role="alert"]');
      expect(fieldError).toBeInTheDocument();
      expect(fieldError?.textContent).toMatch(/please enter your 6-digit code/i);
    });

    // challengeAndVerify must NOT have been called.
    expect(mockMfaChallengeAndVerify).not.toHaveBeenCalled();
  });

  it("non-numeric code: shows length-guard error and does NOT call challengeAndVerify", async () => {
    mockEnrollSuccess();
    render(<MfaEnroll redirectTarget="/dashboard" />);

    const input = await screen.findByLabelText(/6-digit code/i);
    fireEvent.change(input, { target: { value: "abcdef" } });
    fireEvent.click(screen.getByRole("button", { name: /verify and enable/i }));

    await waitFor(() => {
      const fieldError = document.querySelector('p[role="alert"]');
      expect(fieldError).toBeInTheDocument();
      expect(fieldError?.textContent).toMatch(/please enter your 6-digit code/i);
    });

    expect(mockMfaChallengeAndVerify).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// MfaChallenge tests
// ---------------------------------------------------------------------------

describe("MfaChallenge", () => {
  it("renders a 6-digit code input and a verify button", () => {
    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/dashboard" />);

    expect(screen.getByLabelText(/6-digit code/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^verify$/i })).toBeInTheDocument();
  });

  it("renders instructional copy", () => {
    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/dashboard" />);
    expect(screen.getByText(/open your authenticator app/i)).toBeInTheDocument();
  });

  it("does not show an error message on initial render", () => {
    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/dashboard" />);
    // The Field error paragraph is only rendered when an error exists.
    // Look for a non-empty error: the AuthCard aria-live banner is sr-only and empty.
    const alertBanner = document.querySelector('[role="alert"][aria-live="polite"]');
    expect(alertBanner?.textContent?.trim()).toBe("");
    // No Field-level error paragraph should be present.
    expect(document.querySelector('p[role="alert"]')).not.toBeInTheDocument();
  });

  it("calls challengeAndVerify with the factorId and entered code on submit", async () => {
    mockMfaChallengeAndVerify.mockResolvedValue({ error: null });

    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/dashboard" />);

    fireEvent.change(screen.getByLabelText(/6-digit code/i), {
      target: { value: "112233" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() =>
      expect(mockMfaChallengeAndVerify).toHaveBeenCalledWith({
        factorId: "factor-xyz",
        code: "112233",
      }),
    );
  });

  it("navigates to redirectTarget on success", async () => {
    mockMfaChallengeAndVerify.mockResolvedValue({ error: null });

    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/admin" />);

    fireEvent.change(screen.getByLabelText(/6-digit code/i), {
      target: { value: "998877" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => expect(mockLocationAssign).toHaveBeenCalledWith("/admin"));
  });

  it("shows an inline error when challengeAndVerify returns an error", async () => {
    mockMfaChallengeAndVerify.mockResolvedValue({
      error: { message: "Invalid TOTP code entered. Please try again." },
    });

    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/dashboard" />);

    fireEvent.change(screen.getByLabelText(/6-digit code/i), {
      target: { value: "000000" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    // The Field component renders the error in a <p role="alert"> element.
    await waitFor(() => {
      const fieldError = document.querySelector('p[role="alert"]');
      expect(fieldError).toBeInTheDocument();
      expect(fieldError?.textContent).toMatch(/invalid totp code/i);
    });
  });

  it("does not navigate when an error is returned", async () => {
    mockMfaChallengeAndVerify.mockResolvedValue({
      error: { message: "Code expired." },
    });

    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/dashboard" />);

    fireEvent.change(screen.getByLabelText(/6-digit code/i), {
      target: { value: "111111" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    // Wait for the inline error to appear.
    await waitFor(() => {
      const fieldError = document.querySelector('p[role="alert"]');
      expect(fieldError).toBeInTheDocument();
      expect(fieldError?.textContent).toMatch(/code expired/i);
    });

    expect(mockLocationAssign).not.toHaveBeenCalled();
  });

  it("short code: shows length-guard error and does NOT call challengeAndVerify", async () => {
    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/dashboard" />);

    // Enter a code that is too short (only 3 digits)
    fireEvent.change(screen.getByLabelText(/6-digit code/i), {
      target: { value: "123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    // The length-guard error must appear inline.
    await waitFor(() => {
      const fieldError = document.querySelector('p[role="alert"]');
      expect(fieldError).toBeInTheDocument();
      expect(fieldError?.textContent).toMatch(/please enter your 6-digit code/i);
    });

    // challengeAndVerify must NOT have been called.
    expect(mockMfaChallengeAndVerify).not.toHaveBeenCalled();
  });

  it("non-numeric code: shows length-guard error and does NOT call challengeAndVerify", async () => {
    render(<MfaChallenge factorId="factor-xyz" redirectTarget="/dashboard" />);

    fireEvent.change(screen.getByLabelText(/6-digit code/i), {
      target: { value: "abc123" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^verify$/i }));

    await waitFor(() => {
      const fieldError = document.querySelector('p[role="alert"]');
      expect(fieldError).toBeInTheDocument();
      expect(fieldError?.textContent).toMatch(/please enter your 6-digit code/i);
    });

    expect(mockMfaChallengeAndVerify).not.toHaveBeenCalled();
  });
});
