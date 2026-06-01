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

// Stub the server action — tests override per-test as needed.
const mockSignIn = vi.fn();
vi.mock("@/app/(auth)/actions", () => ({
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

// ---------------------------------------------------------------------------
// Component under test (imported AFTER mocks are registered).
// ---------------------------------------------------------------------------
import { LoginForm } from "@/app/(auth)/login/login-form";

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
