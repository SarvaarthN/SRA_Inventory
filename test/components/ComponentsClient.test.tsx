// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ComponentsClient from "@/app/components/ComponentsClient";
import { makeComponent, resetFixtureCounters } from "../helpers/upstash";

vi.mock("next/link", () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

beforeEach(resetFixtureCounters);

/**
 * REGRESSION — 2026-09-19, the user-visible form of the bug.
 *
 * Typing a single character into the search box crashed the whole page with
 * "This page couldn't load". Everything below fails against the shipped code.
 */
describe("ComponentsClient search does not crash the page", () => {
  // Locations exactly as Upstash hands them back.
  const boxLocations = {
    "BOX-001": 101 as unknown as string,
    "BOX-002": true as unknown as string,
    "BOX-003": "Cabinet 3, Shelf 2",
  };

  const components = [
    makeComponent({ name: "HC-SR04 Ultrasonic", boxId: "BOX-001", boxName: "Workbench" }),
    makeComponent({ name: "SG90 Servo", boxId: "BOX-002", boxName: "Motors" }),
    makeComponent({ name: "Soldering Iron", boxId: "BOX-003", boxName: "Tools", category: "TOOL" }),
  ];

  it("renders the full list before any search", () => {
    render(
      <ComponentsClient
        initialComponents={components}
        boxLocations={boxLocations}
        canWrite
      />
    );
    expect(screen.getAllByText("HC-SR04 Ultrasonic").length).toBeGreaterThan(0);
    expect(screen.getAllByText("SG90 Servo").length).toBeGreaterThan(0);
  });

  it("survives typing a single character — the exact crash trigger", async () => {
    const user = userEvent.setup();
    render(
      <ComponentsClient
        initialComponents={components}
        boxLocations={boxLocations}
        canWrite
      />
    );
    const box = screen.getByPlaceholderText(/search by name/i);

    // Before the fix this threw and unmounted the tree.
    await user.type(box, "s");

    expect(box).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Components" })).toBeInTheDocument();
  });

  it("survives typing a full multi-character query", async () => {
    const user = userEvent.setup();
    render(
      <ComponentsClient
        initialComponents={components}
        boxLocations={boxLocations}
        canWrite
      />
    );
    const box = screen.getByPlaceholderText(/search by name/i);
    await user.type(box, "servo");
    expect(screen.getAllByText("SG90 Servo").length).toBeGreaterThan(0);
    expect(screen.queryByText("HC-SR04 Ultrasonic")).not.toBeInTheDocument();
  });

  it("survives a query matching nothing and shows the empty state", async () => {
    const user = userEvent.setup();
    render(
      <ComponentsClient
        initialComponents={components}
        boxLocations={boxLocations}
        canWrite
      />
    );
    await user.type(screen.getByPlaceholderText(/search by name/i), "zzzzzz");
    expect(screen.getByText(/no components found/i)).toBeInTheDocument();
  });

  it("can search by a numeric box location that Upstash coerced", async () => {
    const user = userEvent.setup();
    render(
      <ComponentsClient
        initialComponents={components}
        boxLocations={boxLocations}
        canWrite
      />
    );
    await user.type(screen.getByPlaceholderText(/search by name/i), "101");
    expect(screen.getAllByText("HC-SR04 Ultrasonic").length).toBeGreaterThan(0);
    expect(screen.queryByText("SG90 Servo")).not.toBeInTheDocument();
  });

  it("survives every letter and digit typed one at a time", async () => {
    const user = userEvent.setup();
    render(
      <ComponentsClient
        initialComponents={components}
        boxLocations={boxLocations}
        canWrite
      />
    );
    const box = screen.getByPlaceholderText(/search by name/i);
    for (const ch of "abcdefghijklmnopqrstuvwxyz0123456789") {
      await user.clear(box);
      await user.type(box, ch);
      expect(screen.getByRole("heading", { name: "Components" })).toBeInTheDocument();
    }
  });

  it("renders with no box locations at all", async () => {
    const user = userEvent.setup();
    render(
      <ComponentsClient initialComponents={components} boxLocations={{}} canWrite />
    );
    await user.type(screen.getByPlaceholderText(/search by name/i), "a");
    expect(screen.getByRole("heading", { name: "Components" })).toBeInTheDocument();
  });

  it("renders with an empty component list", () => {
    render(<ComponentsClient initialComponents={[]} boxLocations={{}} canWrite />);
    expect(screen.getByText(/no components found/i)).toBeInTheDocument();
  });
});

describe("ComponentsClient respects write permission", () => {
  const components = [makeComponent()];

  it("shows Add Component to a writer", () => {
    render(<ComponentsClient initialComponents={components} boxLocations={{}} canWrite />);
    expect(screen.getByRole("link", { name: /add/i })).toBeInTheDocument();
  });

  it("hides Add Component from a read-only SY member", () => {
    render(
      <ComponentsClient initialComponents={components} boxLocations={{}} canWrite={false} />
    );
    expect(screen.queryByRole("link", { name: /add component/i })).not.toBeInTheDocument();
  });
});

describe("ComponentsClient category filter", () => {
  const components = [
    makeComponent({ name: "Sensor A", category: "SENS", categoryLabel: "Sensors" }),
    makeComponent({ name: "Hammer", category: "TOOL", categoryLabel: "Tools" }),
  ];

  it("narrows the list to the selected category", async () => {
    const user = userEvent.setup();
    render(<ComponentsClient initialComponents={components} boxLocations={{}} canWrite />);
    await user.click(screen.getByRole("button", { name: "Tools" }));
    expect(screen.getAllByText("Hammer").length).toBeGreaterThan(0);
    expect(screen.queryByText("Sensor A")).not.toBeInTheDocument();
  });

  it("combines category filter with free-text search", async () => {
    const user = userEvent.setup();
    render(<ComponentsClient initialComponents={components} boxLocations={{}} canWrite />);
    await user.click(screen.getByRole("button", { name: "Tools" }));
    await user.type(screen.getByPlaceholderText(/search by name/i), "sensor");
    expect(screen.getByText(/no components found/i)).toBeInTheDocument();
  });
});
