import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Button } from "@/components/ui/Button";
import { ColorPips } from "@/components/ColorPips";
import { AuthForm } from "@/components/AuthForm";

describe("Button", () => {
  it("renders children and responds to variant/size", () => {
    render(<Button variant="danger" size="lg">Delete</Button>);
    const btn = screen.getByRole("button", { name: "Delete" });
    expect(btn).toBeInTheDocument();
    expect(btn.className).toContain("bg-danger");
  });
});

describe("ColorPips", () => {
  it("renders a pip per color", () => {
    render(<ColorPips identity={["W", "U", "B"]} />);
    expect(screen.getByTitle("W")).toBeInTheDocument();
    expect(screen.getByTitle("U")).toBeInTheDocument();
    expect(screen.getByTitle("B")).toBeInTheDocument();
  });
  it("shows colorless when empty", () => {
    render(<ColorPips identity={[]} />);
    expect(screen.getByTitle("C")).toBeInTheDocument();
  });
});

describe("AuthForm", () => {
  it("renders identifier + password fields for login (no email)", () => {
    render(
      <MemoryRouter>
        <AuthForm mode="login" />
      </MemoryRouter>
    );
    expect(screen.getByLabelText("Username or email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.queryByLabelText("Email")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /log in/i })).toBeInTheDocument();
  });

  it("shows username, email and password fields in register mode", () => {
    render(
      <MemoryRouter>
        <AuthForm mode="register" />
      </MemoryRouter>
    );
    expect(screen.getByLabelText("Username", { exact: true })).toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign up/i })).toBeInTheDocument();
  });
});
