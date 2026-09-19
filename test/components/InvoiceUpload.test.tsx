// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import InvoiceUpload from "@/components/InvoiceUpload";

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

const CATEGORIES = [
  { code: "SENS", label: "Sensors", color: "", isDefault: "true", createdAt: "" },
  { code: "MISC", label: "Miscellaneous", color: "", isDefault: "true", createdAt: "" },
];

function jsonResponse(body: unknown, ok = true) {
  return Promise.resolve({
    ok,
    json: () => Promise.resolve(body),
  } as Response);
}

async function openDialog(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /upload invoice/i }));
}

async function selectFile(user: ReturnType<typeof userEvent.setup>) {
  const file = new File(["invoice bytes"], "invoice.jpg", { type: "image/jpeg" });
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  await user.upload(input, file);
}

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (String(url).includes("/api/categories")) return jsonResponse(CATEGORIES);
      throw new Error(`Unexpected fetch to ${url}`);
    })
  );
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("InvoiceUpload — upload step", () => {
  it("blocks parsing with a toast when no file is chosen", async () => {
    const user = userEvent.setup();
    render(<InvoiceUpload />);
    await openDialog(user);
    await user.type(screen.getByPlaceholderText(/robu\.in/i), "Robu.in");
    await user.click(screen.getByRole("button", { name: /parse invoice/i }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/choose an invoice/i));
  });

  it("blocks parsing with a toast when the company name is empty", async () => {
    const user = userEvent.setup();
    render(<InvoiceUpload />);
    await openDialog(user);
    await selectFile(user);
    await user.click(screen.getByRole("button", { name: /parse invoice/i }));
    expect(toast.error).toHaveBeenCalledWith(expect.stringMatching(/vendor.*company/i));
  });
});

describe("InvoiceUpload — review step", () => {
  async function parseToReview(user: ReturnType<typeof userEvent.setup>) {
    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (String(url).includes("/api/categories")) return jsonResponse(CATEGORIES);
      if (String(url).includes("/api/invoices/parse")) {
        return jsonResponse({
          items: [{ name: "HC-SR04", category: "SENS", quantity: 5, description: "" }],
        });
      }
      throw new Error(`Unexpected fetch to ${url}`);
    });
    render(<InvoiceUpload />);
    await openDialog(user);
    await selectFile(user);
    await user.type(screen.getByPlaceholderText(/robu\.in/i), "Robu.in");
    await user.click(screen.getByRole("button", { name: /parse invoice/i }));
    await waitFor(() => expect(screen.getByDisplayValue("HC-SR04")).toBeInTheDocument());
  }

  it("renders the parsed item for editing", async () => {
    const user = userEvent.setup();
    await parseToReview(user);
    expect(screen.getByDisplayValue("HC-SR04")).toBeInTheDocument();
    expect(screen.getByDisplayValue("5")).toBeInTheDocument();
  });

  it("removes a row when its trash button is clicked", async () => {
    const user = userEvent.setup();
    await parseToReview(user);
    await user.click(screen.getByTitle(/remove item/i));
    expect(screen.queryByDisplayValue("HC-SR04")).not.toBeInTheDocument();
  });

  it("adds a blank row when 'Add missing item' is clicked", async () => {
    const user = userEvent.setup();
    await parseToReview(user);
    await user.click(screen.getByRole("button", { name: /add missing item/i }));
    const nameInputs = screen.getAllByPlaceholderText(/item name/i);
    expect(nameInputs).toHaveLength(2);
  });

  it("sends the edited items, not the originally parsed ones, on commit", async () => {
    const user = userEvent.setup();
    await parseToReview(user);

    const nameInput = screen.getByDisplayValue("HC-SR04");
    await user.clear(nameInput);
    await user.type(nameInput, "DHT11");

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (String(url).includes("/api/invoices/commit")) {
        return jsonResponse({ results: [{ type: "box", message: "Box created" }] });
      }
      return jsonResponse(CATEGORIES);
    });

    await user.click(screen.getByRole("button", { name: /add to inventory/i }));

    await waitFor(() => {
      const call = (global.fetch as ReturnType<typeof vi.fn>).mock.calls.find(([url]) =>
        String(url).includes("/api/invoices/commit")
      );
      expect(call).toBeTruthy();
      const sentBody = JSON.parse(call![1].body);
      expect(sentBody.items[0].name).toBe("DHT11");
      expect(sentBody.companyName).toBe("Robu.in");
    });
  });

  it("shows the result list after a successful commit", async () => {
    const user = userEvent.setup();
    await parseToReview(user);

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (String(url).includes("/api/invoices/commit")) {
        return jsonResponse({
          results: [
            { type: "box", message: 'Box "Robu.in_2026-09-19" created' },
            { type: "component_new", message: '"HC-SR04" created' },
          ],
        });
      }
      return jsonResponse(CATEGORIES);
    });

    await user.click(screen.getByRole("button", { name: /add to inventory/i }));

    await waitFor(() => {
      expect(screen.getByText(/Robu\.in_2026-09-19/)).toBeInTheDocument();
      expect(screen.getByText(/"HC-SR04" created/)).toBeInTheDocument();
    });
  });

  it("shows a toast and keeps the review state on commit failure", async () => {
    const user = userEvent.setup();
    await parseToReview(user);

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation((url: string) => {
      if (String(url).includes("/api/invoices/commit")) {
        return jsonResponse({ error: "Server exploded" }, false);
      }
      return jsonResponse(CATEGORIES);
    });

    await user.click(screen.getByRole("button", { name: /add to inventory/i }));

    await waitFor(() => expect(toast.error).toHaveBeenCalledWith("Server exploded"));
    expect(screen.getByDisplayValue("HC-SR04")).toBeInTheDocument();
  });
});
